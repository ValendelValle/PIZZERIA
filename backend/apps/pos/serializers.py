from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Mesa,
    Producto,
    Pedido,
    DetallePedido,
    Ticket,
    Ingrediente,
    MovimientoInventario,
    RecetaProducto,
)


class MesaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mesa
        fields = ['id', 'numero_mesa', 'estado']


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'tipo', 'precio', 'activo']


class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario', 'subtotal']


class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['codigo_qr', 'url_ticket', 'fecha_generacion']


class PedidoSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    mesa_numero = serializers.IntegerField(source='mesa.numero_mesa', read_only=True)
    ticket = TicketSerializer(read_only=True)

    class Meta:
        model = Pedido
        fields = [
            'id',
            'folio',
            'fecha_hora',
            'estado',
            'subtotal',
            'impuesto',
            'total',
            'insumos_confirmados',
            'mesa',
            'mesa_numero',
            'detalles',
            'ticket',
        ]


class PedidoItemInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)


class CrearPedidoSerializer(serializers.Serializer):
    mesa_id = serializers.IntegerField(required=False, allow_null=True)
    items = PedidoItemInputSerializer(many=True)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Debes agregar al menos un producto.')
        return items

    def create(self, validated_data):
        from .services import crear_pedido_desde_carrito

        mesa_id = validated_data.get('mesa_id')
        items = validated_data['items']
        usuario = self.context.get('usuario')
        return crear_pedido_desde_carrito(items=items, mesa_id=mesa_id, usuario=usuario)


class CambiarEstadoPedidoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=Pedido.Estado.choices)


class IngredienteSerializer(serializers.ModelSerializer):
    bajo_minimo = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ingrediente
        fields = ['id', 'nombre', 'unidad', 'stock_actual', 'stock_minimo', 'bajo_minimo']


class EntradaInventarioSerializer(serializers.Serializer):
    ingrediente_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    observacion = serializers.CharField(required=False, allow_blank=True)

    @transaction.atomic
    def create(self, validated_data):
        ingrediente = Ingrediente.objects.select_for_update().get(pk=validated_data['ingrediente_id'])
        cantidad = validated_data['cantidad']
        ingrediente.stock_actual = (ingrediente.stock_actual + cantidad).quantize(Decimal('0.01'))
        ingrediente.save(update_fields=['stock_actual'])
        return MovimientoInventario.objects.create(
            tipo=MovimientoInventario.Tipo.ENTRADA,
            cantidad=cantidad,
            observacion=validated_data.get('observacion', ''),
            ingrediente=ingrediente,
            usuario=self.context.get('usuario'),
        )


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    ingrediente_nombre = serializers.CharField(source='ingrediente.nombre', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = ['id', 'tipo', 'cantidad', 'fecha_hora', 'observacion', 'ingrediente', 'ingrediente_nombre', 'pedido']


class TopProductoSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    producto_nombre = serializers.CharField()
    total_vendido = serializers.IntegerField()
    importe = serializers.DecimalField(max_digits=10, decimal_places=2)


class RequerimientoInsumoSerializer(serializers.Serializer):
    ingrediente_id = serializers.IntegerField()
    ingrediente_nombre = serializers.CharField()
    unidad = serializers.CharField()
    requerido = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_actual = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_suficiente = serializers.BooleanField()