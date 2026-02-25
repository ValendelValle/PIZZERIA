from decimal import Decimal
from collections import defaultdict
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
import qrcode
import base64
from io import BytesIO

from .models import (
    Mesa,
    Producto,
    Pedido,
    DetallePedido,
    Ticket,
    Ingrediente,
    RecetaProducto,
    MovimientoInventario,
)


def generar_folio() -> str:
    stamp = timezone.now().strftime('%Y%m%d%H%M%S%f')
    return f"T{stamp}"


def generar_qr_base64(texto: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(texto)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{encoded}"


@transaction.atomic
def crear_pedido_desde_carrito(items, mesa_id=None, usuario=None):
    mesa = None
    if mesa_id:
        mesa = Mesa.objects.select_for_update().filter(pk=mesa_id).first()
        if not mesa:
            raise ValidationError('La mesa seleccionada no existe.')

    folio = generar_folio()
    pedido = Pedido.objects.create(
        folio=folio,
        mesa=mesa,
        usuario=usuario,
        estado=Pedido.Estado.PENDIENTE,
    )

    productos = {p.id: p for p in Producto.objects.filter(id__in=[item['producto_id'] for item in items], activo=True)}
    if len(productos) != len({item['producto_id'] for item in items}):
        raise ValidationError('Uno o varios productos no estan disponibles.')

    for item in items:
        producto = productos[item['producto_id']]
        cantidad = int(item['cantidad'])
        subtotal = (producto.precio * Decimal(cantidad)).quantize(Decimal('0.01'))
        DetallePedido.objects.create(
            pedido=pedido,
            producto=producto,
            cantidad=cantidad,
            precio_unitario=producto.precio,
            subtotal=subtotal,
        )

    pedido.recalcular_totales()

    if mesa:
        mesa.estado = Mesa.Estado.OCUPADA
        mesa.save(update_fields=['estado'])

    url_ticket = f"{settings.FRONTEND_TICKET_BASE_URL}/{pedido.folio}"
    codigo_qr = generar_qr_base64(url_ticket)
    Ticket.objects.create(
        pedido=pedido,
        codigo_qr=codigo_qr,
        url_ticket=url_ticket,
    )

    return pedido


def calcular_requerimientos_insumos(pedido: Pedido):
    requerimientos = defaultdict(Decimal)
    detalle_ids = []
    for detalle in pedido.detalles.select_related('producto').all():
        detalle_ids.append(detalle.id)
        recetas = RecetaProducto.objects.filter(producto=detalle.producto).select_related('ingrediente')
        for receta in recetas:
            requerimientos[receta.ingrediente_id] += receta.cantidad * Decimal(detalle.cantidad)

    data = []
    ingredientes = {ing.id: ing for ing in Ingrediente.objects.filter(id__in=requerimientos.keys())}
    for ingrediente_id, requerido in requerimientos.items():
        ingrediente = ingredientes[ingrediente_id]
        requerido = requerido.quantize(Decimal('0.01'))
        data.append(
            {
                'ingrediente_id': ingrediente.id,
                'ingrediente_nombre': ingrediente.nombre,
                'unidad': ingrediente.unidad,
                'requerido': requerido,
                'stock_actual': ingrediente.stock_actual,
                'stock_suficiente': ingrediente.stock_actual >= requerido,
            }
        )

    data.sort(key=lambda x: x['ingrediente_nombre'])
    return data


@transaction.atomic
def confirmar_salida_insumos(pedido: Pedido, usuario=None):
    if pedido.insumos_confirmados:
        return pedido

    requerimientos = calcular_requerimientos_insumos(pedido)
    if not requerimientos:
        pedido.insumos_confirmados = True
        pedido.save(update_fields=['insumos_confirmados'])
        return pedido

    ingredientes_map = {
        ing.id: ing
        for ing in Ingrediente.objects.select_for_update().filter(id__in=[req['ingrediente_id'] for req in requerimientos])
    }

    faltantes = [
        f"{req['ingrediente_nombre']} ({req['requerido']} {req['unidad']})"
        for req in requerimientos
        if ingredientes_map[req['ingrediente_id']].stock_actual < req['requerido']
    ]
    if faltantes:
        raise ValidationError(
            {'detalle': 'No hay stock suficiente para confirmar la salida.', 'faltantes': faltantes}
        )

    for req in requerimientos:
        ingrediente = ingredientes_map[req['ingrediente_id']]
        ingrediente.stock_actual = (ingrediente.stock_actual - req['requerido']).quantize(Decimal('0.01'))
        ingrediente.save(update_fields=['stock_actual'])

        MovimientoInventario.objects.create(
            tipo=MovimientoInventario.Tipo.SALIDA,
            cantidad=req['requerido'],
            observacion=f"Salida por pedido {pedido.folio}",
            ingrediente=ingrediente,
            usuario=usuario,
            pedido=pedido,
        )

    pedido.insumos_confirmados = True
    pedido.save(update_fields=['insumos_confirmados'])
    return pedido


def mover_estado_pedido(pedido: Pedido, nuevo_estado: str):
    estados_validos = [choice for choice, _ in Pedido.Estado.choices]
    if nuevo_estado not in estados_validos:
        raise ValidationError('Estado no valido.')

    if nuevo_estado == Pedido.Estado.EN_HORNO and not pedido.insumos_confirmados:
        raise ValidationError('Confirma primero la salida de insumos antes de mover a En horno.')

    pedido.estado = nuevo_estado
    pedido.save(update_fields=['estado'])
    return pedido