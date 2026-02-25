from django.contrib import admin
from .models import (
    UsuarioPerfil,
    Mesa,
    Producto,
    Ingrediente,
    RecetaProducto,
    Pedido,
    DetallePedido,
    Ticket,
    MovimientoInventario,
)

admin.site.register(UsuarioPerfil)
admin.site.register(Mesa)
admin.site.register(Producto)
admin.site.register(Ingrediente)
admin.site.register(RecetaProducto)
admin.site.register(Pedido)
admin.site.register(DetallePedido)
admin.site.register(Ticket)
admin.site.register(MovimientoInventario)