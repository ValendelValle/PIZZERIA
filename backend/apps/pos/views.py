from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import authenticate
from django.db import DatabaseError, connection, transaction
from django.db.models import DecimalField, F, IntegerField, Sum, Value
from django.db.models.deletion import ProtectedError
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AdminAccion,
    DetallePedido,
    Ingrediente,
    Mesa,
    MovimientoInventario,
    Pedido,
    Producto,
    Ticket,
    UsuarioPerfil,
)
from .permissions import IsAdmin, IsProduccionOrAdmin
from .serializers import (
    AdminAccionSerializer,
    CambiarEstadoPedidoSerializer,
    CrearPedidoSerializer,
    EntradaInventarioSerializer,
    IngredienteSerializer,
    MesaSerializer,
    MovimientoInventarioSerializer,
    PedidoSerializer,
    ProductoSerializer,
    UserSessionSerializer,
)
from .services import calcular_requerimientos_insumos, confirmar_salida_insumos, mover_estado_pedido


def _decimal_str(value):
    return str(Decimal(value).quantize(Decimal('0.01')))


def _snapshot_producto(producto):
    return {
        'id': producto.id,
        'nombre': producto.nombre,
        'tipo': producto.tipo,
        'precio': _decimal_str(producto.precio),
        'activo': bool(producto.activo),
    }


def _snapshot_ingrediente(ingrediente):
    return {
        'id': ingrediente.id,
        'nombre': ingrediente.nombre,
        'unidad': ingrediente.unidad,
        'stock_actual': _decimal_str(ingrediente.stock_actual),
        'stock_minimo': _decimal_str(ingrediente.stock_minimo),
    }


def _snapshot_mesa(mesa):
    return {
        'id': mesa.id,
        'numero_mesa': mesa.numero_mesa,
        'estado': mesa.estado,
    }


def _registrar_accion_admin(*, request, entidad, accion, entidad_id=None, antes=None, despues=None, detalle=''):
    usuario = request.user if request.user and request.user.is_authenticated else None
    return AdminAccion.objects.create(
        entidad=entidad,
        accion=accion,
        entidad_id=entidad_id,
        antes=antes,
        despues=despues,
        detalle=detalle,
        creado_por=usuario,
    )


def _restaurar_producto(snapshot):
    Producto.objects.update_or_create(
        id=snapshot['id'],
        defaults={
            'nombre': snapshot['nombre'],
            'tipo': snapshot['tipo'],
            'precio': Decimal(str(snapshot['precio'])),
            'activo': bool(snapshot['activo']),
        },
    )


def _restaurar_ingrediente(snapshot):
    Ingrediente.objects.update_or_create(
        id=snapshot['id'],
        defaults={
            'nombre': snapshot['nombre'],
            'unidad': snapshot['unidad'],
            'stock_actual': Decimal(str(snapshot['stock_actual'])),
            'stock_minimo': Decimal(str(snapshot['stock_minimo'])),
        },
    )


def _restaurar_mesa(snapshot):
    Mesa.objects.update_or_create(
        id=snapshot['id'],
        defaults={
            'numero_mesa': snapshot['numero_mesa'],
            'estado': snapshot['estado'],
        },
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    db_ok = True
    db_error = ''
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
    except DatabaseError as exc:
        db_ok = False
        db_error = str(exc)

    status_code = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response(
        {
            'ok': db_ok,
            'api': 'operativa' if db_ok else 'degradada',
            'database': {'ok': db_ok, 'error': db_error},
            'timestamp': timezone.now(),
        },
        status=status_code,
    )


class AuthLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        password = str(request.data.get('password', ''))

        user = authenticate(request=request, username=username, password=password)
        if not user:
            return Response({'detail': 'Credenciales invalidas.'}, status=status.HTTP_401_UNAUTHORIZED)

        defaults = {'rol': UsuarioPerfil.Rol.ADMIN if user.is_staff or user.is_superuser else UsuarioPerfil.Rol.PRODUCCION}
        perfil, _ = UsuarioPerfil.objects.get_or_create(user=user, defaults=defaults)
        if perfil.rol not in {UsuarioPerfil.Rol.ADMIN, UsuarioPerfil.Rol.PRODUCCION}:
            perfil.rol = UsuarioPerfil.Rol.PRODUCCION
            perfil.save(update_fields=['rol'])

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'usuario': UserSessionSerializer(user).data})


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'usuario': UserSessionSerializer(request.user).data})


class AuthLogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.auth and hasattr(request.auth, 'delete'):
            request.auth.delete()
        else:
            Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CatalogoView(APIView):
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]

    def post(self, request):
        usuario = request.user if request.user.is_authenticated else None
        serializer = CrearPedidoSerializer(data=request.data, context={'usuario': usuario})
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


class PedidoDetailView(APIView):
    permission_classes = [IsProduccionOrAdmin]

    def get(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        return Response(PedidoSerializer(pedido).data)


class PedidoHistorialView(APIView):
    permission_classes = [IsProduccionOrAdmin]

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

        return Response(PedidoSerializer(pedidos[:300], many=True).data)


class PedidoCambiarEstadoView(APIView):
    permission_classes = [IsProduccionOrAdmin]

    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido, pk=pedido_id)
        serializer = CambiarEstadoPedidoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = mover_estado_pedido(pedido, serializer.validated_data['estado'])
        return Response(PedidoSerializer(pedido).data)


class PedidoConfirmarInsumosView(APIView):
    permission_classes = [IsProduccionOrAdmin]

    def post(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        pedido = confirmar_salida_insumos(pedido, usuario=request.user)
        return Response(PedidoSerializer(pedido).data)


class PedidoRequerimientosView(APIView):
    permission_classes = [IsProduccionOrAdmin]

    def get(self, request, pedido_id):
        pedido = get_object_or_404(Pedido.objects.prefetch_related('detalles__producto'), pk=pedido_id)
        data = calcular_requerimientos_insumos(pedido)
        return Response({'folio': pedido.folio, 'requerimientos': data})


class TicketByFolioView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, folio):
        ticket = get_object_or_404(
            Ticket.objects.select_related('pedido__mesa').prefetch_related('pedido__detalles__producto'),
            pedido__folio=folio,
        )
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
    permission_classes = [IsProduccionOrAdmin]

    def get(self, request):
        activos = Pedido.objects.filter(
            estado__in=[Pedido.Estado.PENDIENTE, Pedido.Estado.EN_HORNO, Pedido.Estado.LISTO]
        ).select_related('mesa').prefetch_related('detalles__producto')
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
    permission_classes = [IsProduccionOrAdmin]

    def post(self, request, mesa_id):
        mesa = get_object_or_404(Mesa, pk=mesa_id)
        mesa.estado = Mesa.Estado.LIBRE
        mesa.save(update_fields=['estado'])
        return Response(MesaSerializer(mesa).data)


class InventarioIngredientesView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        ingredientes = Ingrediente.objects.all()
        return Response(IngredienteSerializer(ingredientes, many=True).data)


class InventarioEntradaView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        serializer = EntradaInventarioSerializer(data=request.data, context={'usuario': request.user})
        serializer.is_valid(raise_exception=True)
        movimiento = serializer.save()

        ingrediente = movimiento.ingrediente
        stock_despues = Decimal(ingrediente.stock_actual)
        stock_antes = (stock_despues - Decimal(movimiento.cantidad)).quantize(Decimal('0.01'))

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.INVENTARIO_ENTRADA,
            accion=AdminAccion.Accion.CREAR,
            entidad_id=movimiento.id,
            antes={
                'movimiento_id': movimiento.id,
                'ingrediente_id': ingrediente.id,
                'stock_antes': _decimal_str(stock_antes),
            },
            despues={
                'movimiento_id': movimiento.id,
                'ingrediente_id': ingrediente.id,
                'cantidad': _decimal_str(movimiento.cantidad),
                'stock_despues': _decimal_str(stock_despues),
            },
            detalle=f'Entrada de inventario: {ingrediente.nombre}',
        )

        return Response(MovimientoInventarioSerializer(movimiento).data, status=status.HTTP_201_CREATED)


class InventarioMovimientosView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        movimientos = MovimientoInventario.objects.select_related('ingrediente', 'pedido').all()[:250]
        return Response(MovimientoInventarioSerializer(movimientos, many=True).data)


class ReporteTopProductosView(APIView):
    permission_classes = [IsAdmin]

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
            detalles.values('producto_id')
            .annotate(
                producto_nombre=F('producto__nombre'),
                total_vendido=Coalesce(Sum('cantidad'), Value(0), output_field=IntegerField()),
                importe=Coalesce(
                    Sum('subtotal'),
                    Value(Decimal('0.00')),
                    output_field=DecimalField(max_digits=10, decimal_places=2),
                ),
            )
            .order_by('-total_vendido', '-importe')[:20]
        )

        return Response({'periodo': periodo, 'top_productos': list(top)})


class AdminDashboardView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        hoy = timezone.localdate()
        inicio_hoy = timezone.make_aware(datetime.combine(hoy, time.min))

        pedidos_hoy = Pedido.objects.filter(fecha_hora__gte=inicio_hoy)
        ventas_hoy = pedidos_hoy.aggregate(
            total=Coalesce(
                Sum('total'),
                Value(Decimal('0.00')),
                output_field=DecimalField(max_digits=10, decimal_places=2),
            )
        )['total']

        pedidos_activos = Pedido.objects.filter(estado__in=[Pedido.Estado.PENDIENTE, Pedido.Estado.EN_HORNO]).count()
        pedidos_listos = Pedido.objects.filter(estado=Pedido.Estado.LISTO).count()
        stock_bajo = Ingrediente.objects.filter(stock_actual__lte=F('stock_minimo')).count()
        movimientos_hoy = MovimientoInventario.objects.filter(fecha_hora__gte=inicio_hoy).count()

        return Response(
            {
                'kpis': {
                    'ventas_hoy': ventas_hoy,
                    'pedidos_hoy': pedidos_hoy.count(),
                    'pedidos_activos': pedidos_activos,
                    'pedidos_listos': pedidos_listos,
                    'stock_bajo': stock_bajo,
                    'movimientos_hoy': movimientos_hoy,
                }
            }
        )


class AdminAccionesListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        limite = int(request.query_params.get('limite', 30))
        limite = max(1, min(limite, 200))
        acciones = AdminAccion.objects.select_related('creado_por').all()[:limite]
        return Response(AdminAccionSerializer(acciones, many=True).data)


class AdminAccionDeshacerView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request, accion_id):
        accion = get_object_or_404(AdminAccion.objects.select_for_update(), pk=accion_id)
        if accion.deshecha:
            return Response({'detail': 'Esta accion ya fue deshecha.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if accion.entidad == AdminAccion.Entidad.PRODUCTO:
                self._deshacer_producto(accion)
            elif accion.entidad == AdminAccion.Entidad.INGREDIENTE:
                self._deshacer_ingrediente(accion)
            elif accion.entidad == AdminAccion.Entidad.MESA:
                self._deshacer_mesa(accion)
            elif accion.entidad == AdminAccion.Entidad.INVENTARIO_ENTRADA:
                self._deshacer_inventario_entrada(accion)
            else:
                return Response({'detail': 'Entidad no soportada para deshacer.'}, status=status.HTTP_400_BAD_REQUEST)
        except ProtectedError:
            return Response(
                {'detail': 'No se pudo deshacer porque existen dependencias relacionadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        accion.deshecha = True
        accion.deshecha_en = timezone.now()
        accion.save(update_fields=['deshecha', 'deshecha_en'])

        return Response({'ok': True, 'accion_id': accion.id, 'deshecha_en': accion.deshecha_en})

    def _deshacer_producto(self, accion):
        if accion.accion == AdminAccion.Accion.CREAR:
            producto = Producto.objects.filter(pk=accion.entidad_id).first()
            if producto:
                producto.delete()
            return

        if accion.accion == AdminAccion.Accion.ACTUALIZAR and accion.antes:
            _restaurar_producto(accion.antes)
            return

        if accion.accion == AdminAccion.Accion.ELIMINAR and accion.antes:
            _restaurar_producto(accion.antes)
            return

        raise ValueError('Accion de producto no reversible.')

    def _deshacer_ingrediente(self, accion):
        if accion.accion == AdminAccion.Accion.CREAR:
            ingrediente = Ingrediente.objects.filter(pk=accion.entidad_id).first()
            if ingrediente:
                ingrediente.delete()
            return

        if accion.accion == AdminAccion.Accion.ACTUALIZAR and accion.antes:
            _restaurar_ingrediente(accion.antes)
            return

        if accion.accion == AdminAccion.Accion.ELIMINAR and accion.antes:
            _restaurar_ingrediente(accion.antes)
            return

        raise ValueError('Accion de ingrediente no reversible.')

    def _deshacer_mesa(self, accion):
        if accion.accion == AdminAccion.Accion.CREAR:
            mesa = Mesa.objects.filter(pk=accion.entidad_id).first()
            if mesa:
                mesa.delete()
            return

        if accion.accion == AdminAccion.Accion.ACTUALIZAR and accion.antes:
            _restaurar_mesa(accion.antes)
            return

        if accion.accion == AdminAccion.Accion.ELIMINAR and accion.antes:
            _restaurar_mesa(accion.antes)
            return

        raise ValueError('Accion de mesa no reversible.')

    def _deshacer_inventario_entrada(self, accion):
        if accion.accion != AdminAccion.Accion.CREAR or not accion.despues:
            raise ValueError('Solo se pueden deshacer entradas de inventario creadas.')

        movimiento_id = accion.despues.get('movimiento_id')
        ingrediente_id = accion.despues.get('ingrediente_id')
        cantidad = Decimal(str(accion.despues.get('cantidad', '0')))

        if not ingrediente_id or cantidad <= 0:
            raise ValueError('Datos insuficientes para deshacer la entrada.')

        ingrediente = Ingrediente.objects.select_for_update().filter(pk=ingrediente_id).first()
        if not ingrediente:
            raise ValueError('El ingrediente asociado ya no existe.')

        if ingrediente.stock_actual < cantidad:
            raise ValueError('No hay stock suficiente para deshacer esta entrada porque ya fue consumido.')

        ingrediente.stock_actual = (ingrediente.stock_actual - cantidad).quantize(Decimal('0.01'))
        ingrediente.save(update_fields=['stock_actual'])

        movimiento = MovimientoInventario.objects.filter(pk=movimiento_id, tipo=MovimientoInventario.Tipo.ENTRADA).first()
        if movimiento:
            movimiento.delete()


class AdminProductoListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        productos = Producto.objects.all().order_by('tipo', 'nombre')
        return Response(ProductoSerializer(productos, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = ProductoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producto = serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.PRODUCTO,
            accion=AdminAccion.Accion.CREAR,
            entidad_id=producto.id,
            antes=None,
            despues=_snapshot_producto(producto),
            detalle=f'Producto creado: {producto.nombre}',
        )

        return Response(ProductoSerializer(producto).data, status=status.HTTP_201_CREATED)


class AdminProductoDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, producto_id):
        producto = get_object_or_404(Producto, pk=producto_id)
        return Response(ProductoSerializer(producto).data)

    @transaction.atomic
    def patch(self, request, producto_id):
        producto = get_object_or_404(Producto, pk=producto_id)
        antes = _snapshot_producto(producto)
        serializer = ProductoSerializer(producto, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.PRODUCTO,
            accion=AdminAccion.Accion.ACTUALIZAR,
            entidad_id=producto.id,
            antes=antes,
            despues=_snapshot_producto(producto),
            detalle=f'Producto actualizado: {producto.nombre}',
        )

        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, producto_id):
        producto = get_object_or_404(Producto, pk=producto_id)
        antes = _snapshot_producto(producto)
        try:
            producto.delete()
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar el producto porque tiene ventas relacionadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.PRODUCTO,
            accion=AdminAccion.Accion.ELIMINAR,
            entidad_id=antes['id'],
            antes=antes,
            despues=None,
            detalle=f'Producto eliminado: {antes["nombre"]}',
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminIngredienteListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        ingredientes = Ingrediente.objects.all().order_by('nombre')
        return Response(IngredienteSerializer(ingredientes, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = IngredienteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ingrediente = serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.INGREDIENTE,
            accion=AdminAccion.Accion.CREAR,
            entidad_id=ingrediente.id,
            antes=None,
            despues=_snapshot_ingrediente(ingrediente),
            detalle=f'Ingrediente creado: {ingrediente.nombre}',
        )

        return Response(IngredienteSerializer(ingrediente).data, status=status.HTTP_201_CREATED)


class AdminIngredienteDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, ingrediente_id):
        ingrediente = get_object_or_404(Ingrediente, pk=ingrediente_id)
        return Response(IngredienteSerializer(ingrediente).data)

    @transaction.atomic
    def patch(self, request, ingrediente_id):
        ingrediente = get_object_or_404(Ingrediente, pk=ingrediente_id)
        antes = _snapshot_ingrediente(ingrediente)
        serializer = IngredienteSerializer(ingrediente, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.INGREDIENTE,
            accion=AdminAccion.Accion.ACTUALIZAR,
            entidad_id=ingrediente.id,
            antes=antes,
            despues=_snapshot_ingrediente(ingrediente),
            detalle=f'Ingrediente actualizado: {ingrediente.nombre}',
        )

        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, ingrediente_id):
        ingrediente = get_object_or_404(Ingrediente, pk=ingrediente_id)
        antes = _snapshot_ingrediente(ingrediente)
        try:
            ingrediente.delete()
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar el ingrediente porque tiene movimientos o recetas relacionadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.INGREDIENTE,
            accion=AdminAccion.Accion.ELIMINAR,
            entidad_id=antes['id'],
            antes=antes,
            despues=None,
            detalle=f'Ingrediente eliminado: {antes["nombre"]}',
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminMesaListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        mesas = Mesa.objects.all().order_by('numero_mesa')
        return Response(MesaSerializer(mesas, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = MesaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mesa = serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.MESA,
            accion=AdminAccion.Accion.CREAR,
            entidad_id=mesa.id,
            antes=None,
            despues=_snapshot_mesa(mesa),
            detalle=f'Mesa creada: {mesa.numero_mesa}',
        )

        return Response(MesaSerializer(mesa).data, status=status.HTTP_201_CREATED)


class AdminMesaDetailView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, mesa_id):
        mesa = get_object_or_404(Mesa, pk=mesa_id)
        return Response(MesaSerializer(mesa).data)

    @transaction.atomic
    def patch(self, request, mesa_id):
        mesa = get_object_or_404(Mesa, pk=mesa_id)
        antes = _snapshot_mesa(mesa)
        serializer = MesaSerializer(mesa, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.MESA,
            accion=AdminAccion.Accion.ACTUALIZAR,
            entidad_id=mesa.id,
            antes=antes,
            despues=_snapshot_mesa(mesa),
            detalle=f'Mesa actualizada: {mesa.numero_mesa}',
        )

        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, mesa_id):
        mesa = get_object_or_404(Mesa, pk=mesa_id)
        antes = _snapshot_mesa(mesa)
        mesa.delete()

        _registrar_accion_admin(
            request=request,
            entidad=AdminAccion.Entidad.MESA,
            accion=AdminAccion.Accion.ELIMINAR,
            entidad_id=antes['id'],
            antes=antes,
            despues=None,
            detalle=f'Mesa eliminada: {antes["numero_mesa"]}',
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
