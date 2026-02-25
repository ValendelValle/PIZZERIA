from decimal import Decimal
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

User = get_user_model()


class UsuarioPerfil(models.Model):
    class Rol(models.TextChoices):
        CAJERO = 'cajero', 'Cajero'
        PRODUCCION = 'produccion', 'Produccion'
        ADMIN = 'admin', 'Admin'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.CAJERO)

    def __str__(self):
        return f"{self.user.username} ({self.get_rol_display()})"


class Mesa(models.Model):
    class Estado(models.TextChoices):
        LIBRE = 'libre', 'Libre'
        OCUPADA = 'ocupada', 'Ocupada'

    numero_mesa = models.PositiveIntegerField(unique=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.LIBRE)

    class Meta:
        ordering = ['numero_mesa']

    def __str__(self):
        return f"Mesa {self.numero_mesa} ({self.estado})"


class Producto(models.Model):
    class Tipo(models.TextChoices):
        PIZZA = 'pizza', 'Pizza'
        BEBIDA = 'bebida', 'Bebida'
        COMBO = 'combo', 'Combo'
        POSTRE = 'postre', 'Postre'

    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['tipo', 'nombre']

    def __str__(self):
        return f"{self.nombre} ({self.tipo})"


class Ingrediente(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    unidad = models.CharField(max_length=30)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @property
    def bajo_minimo(self):
        return self.stock_actual <= self.stock_minimo


class RecetaProducto(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='recetas')
    ingrediente = models.ForeignKey(Ingrediente, on_delete=models.CASCADE, related_name='recetas_producto')
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('producto', 'ingrediente')
        ordering = ['producto__nombre', 'ingrediente__nombre']

    def __str__(self):
        return f"{self.producto.nombre} -> {self.ingrediente.nombre} ({self.cantidad})"


class Pedido(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        EN_HORNO = 'en_horno', 'En horno'
        LISTO = 'listo', 'Listo'

    folio = models.CharField(max_length=30, unique=True)
    fecha_hora = models.DateTimeField(default=timezone.now)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    impuesto = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    insumos_confirmados = models.BooleanField(default=False)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos')
    mesa = models.ForeignKey(Mesa, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos')

    class Meta:
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.folio} - {self.get_estado_display()}"

    @property
    def total_items(self):
        return sum(detalle.cantidad for detalle in self.detalles.all())

    def recalcular_totales(self):
        subtotal = sum((detalle.subtotal for detalle in self.detalles.all()), Decimal('0.00'))
        impuesto = (subtotal * Decimal(str(getattr(settings, 'TAX_RATE', 0.16)))).quantize(Decimal('0.01'))
        total = (subtotal + impuesto).quantize(Decimal('0.01'))
        self.subtotal = subtotal
        self.impuesto = impuesto
        self.total = total
        self.save(update_fields=['subtotal', 'impuesto', 'total'])


class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='detalles')
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.cantidad} x {self.producto.nombre}"


class Ticket(models.Model):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name='ticket')
    codigo_qr = models.TextField()
    url_ticket = models.URLField(max_length=500)
    fecha_generacion = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Ticket {self.pedido.folio}"


class MovimientoInventario(models.Model):
    class Tipo(models.TextChoices):
        ENTRADA = 'entrada', 'Entrada'
        SALIDA = 'salida', 'Salida'

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_hora = models.DateTimeField(default=timezone.now)
    observacion = models.CharField(max_length=255, blank=True)
    ingrediente = models.ForeignKey(Ingrediente, on_delete=models.PROTECT, related_name='movimientos')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='movimientos_inventario')
    pedido = models.ForeignKey(Pedido, on_delete=models.SET_NULL, null=True, blank=True, related_name='movimientos_inventario')

    class Meta:
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.tipo} {self.cantidad} {self.ingrediente.unidad} {self.ingrediente.nombre}"