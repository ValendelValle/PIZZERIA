from datetime import timedelta
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Mesa, Pedido, Producto, Ticket, Ingrediente, MovimientoInventario, DetallePedido
from .serializers import (
    CrearPedidoSerializer,
    PedidoSerializer,
    CambiarEstadoPedidoSerializer,
    MesaSerializer,
    ProductoSerializer,
    IngredienteSerializer,
    EntradaInventarioSerializer,
    MovimientoInventarioSerializer,
)
from .services import (
    calcular_requerimientos_insumos,
    confirmar_salida_insumos,
    mover_estado_pedido,
)


@api_view(['GET'])
def health(request):
    return Response({'ok': True, 'mensaje': 'API POS operativa'})


class CatalogoView(APIView):
    def get(self, request):
        productos = Producto.objects.filter(activo=True)
        mesas = Mesa.objects.all()

        agrupado = {
            'pizza': ProductoSerializer(productos.filter(tipo=Producto.Tipo.PIZZA), many=True).data,
            'bebida': ProductoSerializer(productos.filter(tipo=Producto.Tipo.BEBIDA), many=True).data,
            'postre': ProductoSerializer(productos.filter(tipo=Producto.Tipo.POSTRE), many=True).data,
            'combo': ProductoSerializer(productos.filter(tipo=Producto.Tipo.COMBO), many=True).data,
        }

        return Response({'productos': agrupado, 'mesas': MesaSerializer(mesas, many=True).data})


class PedidoCreateView(APIView):
    def post(self, request):
        serializer = CrearPedidoSerializer(data=request.data, context={'usuario': None})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


class PedidoDetailView(APIView):
    def get(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        return Response(PedidoSerializer(pedido).data)


class PedidoHistorialView(APIView):
    def get(self, request):
        pedidos = Pedido.objects.select_related('mesa').prefetch_related('detalles__producto').all()
        folio = request.query_params.get('folio')
        estado = request.query_params.get('estado')
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if folio:
            pedidos = pedidos.filter(folio__icontains=folio)
        if estado:
            pedidos = pedidos.filter(estado=estado)
        if fecha_desde:
            pedidos = pedidos.filter(fecha_hora__date__gte=fecha_desde)
        if fecha_hasta:
            pedidos = pedidos.filter(fecha_hora__date__lte=fecha_hasta)

        return Response(PedidoSerializer(pedidos[:200], many=True).data)


class PedidoCambiarEstadoView(APIView):
    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido, pk=pedido_id)
        serializer = CambiarEstadoPedidoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = mover_estado_pedido(pedido, serializer.validated_data['estado'])
        return Response(PedidoSerializer(pedido).data)


class PedidoConfirmarInsumosView(APIView):
    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        pedido = confirmar_salida_insumos(pedido, usuario=None)
        return Response(PedidoSerializer(pedido).data)


class PedidoRequerimientosView(APIView):
    def get(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        data = calcular_requerimientos_insumos(pedido)
        return Response({'folio': pedido.folio, 'requerimientos': data})


class TicketByFolioView(APIView):
    def get(self, request, folio):
        ticket = get_object_or_404(Ticket.objects.select_related('pedido__mesa').prefetch_related('pedido__detalles__producto'), pedido__folio=folio)
        pedido = ticket.pedido
        return Response(
            {
                'folio': pedido.folio,
                'fecha_hora': pedido.fecha_hora,
                'mesa': pedido.mesa.numero_mesa if pedido.mesa else None,
                'estado': pedido.estado,
                'subtotal': pedido.subtotal,
                'impuesto': pedido.impuesto,
                'total': pedido.total,
                'detalles': [
                    {
                        'producto': detalle.producto.nombre,
                        'cantidad': detalle.cantidad,
                        'precio_unitario': detalle.precio_unitario,
                        'subtotal': detalle.subtotal,
                    }
                    for detalle in pedido.detalles.all()
                ],
                'ticket': {
                    'codigo_qr': ticket.codigo_qr,
                    'url_ticket': ticket.url_ticket,
                    'fecha_generacion': ticket.fecha_generacion,
                },
            }
        )


class ProduccionTableroView(APIView):
    def get(self, request):
        activos = Pedido.objects.filter(estado__in=[Pedido.Estado.PENDIENTE, Pedido.Estado.EN_HORNO, Pedido.Estado.LISTO]).select_related('mesa').prefetch_related('detalles__producto')
        ahora = timezone.now()

        def pedido_to_row(pedido):
            delta = ahora - pedido.fecha_hora
            minutos = int(delta.total_seconds() // 60)
            segundos = int(delta.total_seconds() % 60)
            tiempo = f"{minutos:02d}:{segundos:02d}"
            return {
                'id': pedido.id,
                'folio': pedido.folio,
                'mesa': pedido.mesa.numero_mesa if pedido.mesa else None,
                'items': [
                    {
                        'nombre': d.producto.nombre,
                        'cantidad': d.cantidad,
                    }
                    for d in pedido.detalles.all()
                ],
                'total': pedido.total,
                'estado': pedido.estado,
                'tiempo': tiempo,
                'insumos_confirmados': pedido.insumos_confirmados,
            }

        return Response(
            {
                'kpis': {
                    'total': activos.count(),
                    'urgentes': activos.filter(estado=Pedido.Estado.PENDIENTE).count(),
                    'en_horno': activos.filter(estado=Pedido.Estado.EN_HORNO).count(),
                    'listos': activos.filter(estado=Pedido.Estado.LISTO).count(),
                },
                'pedidos': [pedido_to_row(p) for p in activos],
            }
        )


class MesaLiberarView(APIView):
    def post(self, request, mesa_id):
        mesa = get_object_or_404(Mesa, pk=mesa_id)
        mesa.estado = Mesa.Estado.LIBRE
        mesa.save(update_fields=['estado'])
        return Response(MesaSerializer(mesa).data)


class InventarioIngredientesView(APIView):
    def get(self, request):
        ingredientes = Ingrediente.objects.all()
        return Response(IngredienteSerializer(ingredientes, many=True).data)


class InventarioEntradaView(APIView):
    def post(self, request):
        serializer = EntradaInventarioSerializer(data=request.data, context={'usuario': None})
        serializer.is_valid(raise_exception=True)
        movimiento = serializer.save()
        return Response(MovimientoInventarioSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class InventarioMovimientosView(APIView):
    def get(self, request):
        movimientos = MovimientoInventario.objects.select_related('ingrediente', 'pedido').all()[:200]
        return Response(MovimientoInventarioSerializer(movimientos, many=True).data)


class ReporteTopProductosView(APIView):
    def get(self, request):
        periodo = request.query_params.get('periodo', 'todo')
        ahora = timezone.now()
        fecha_inicio = None

        if periodo == 'hoy':
            fecha_inicio = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
        elif periodo == 'semana':
            fecha_inicio = ahora - timedelta(days=7)
        elif periodo == 'mes':
            fecha_inicio = ahora - timedelta(days=30)

        detalles = DetallePedido.objects.select_related('producto', 'pedido')
        if fecha_inicio:
            detalles = detalles.filter(pedido__fecha_hora__gte=fecha_inicio)

        top = (
            detalles.values(producto_id=F('producto__id'), producto_nombre=F('producto__nombre'))
            .annotate(total_vendido=Coalesce(Sum('cantidad'), 0), importe=Coalesce(Sum('subtotal'), 0))
            .order_by('-total_vendido', '-importe')[:20]
        )

        return Response({'periodo': periodo, 'top_productos': list(top)})
