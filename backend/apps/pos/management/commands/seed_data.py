from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.pos.models import Mesa, Producto, Ingrediente, RecetaProducto, UsuarioPerfil


class Command(BaseCommand):
    help = 'Carga datos iniciales para pruebas del POS de pizzeria.'

    def handle(self, *args, **kwargs):
        User = get_user_model()

        usuarios = [
            ('cocina', 'cocina123', UsuarioPerfil.Rol.PRODUCCION),
            ('admin', 'admin123', UsuarioPerfil.Rol.ADMIN),
        ]
        for username, password, rol in usuarios:
            is_admin = rol == UsuarioPerfil.Rol.ADMIN
            user, created = User.objects.get_or_create(username=username, defaults={'is_staff': is_admin})
            if created:
                user.set_password(password)
                user.save()
            elif user.is_staff != is_admin:
                user.is_staff = is_admin
                user.save(update_fields=['is_staff'])

            perfil, _ = UsuarioPerfil.objects.get_or_create(user=user, defaults={'rol': rol})
            if perfil.rol != rol:
                perfil.rol = rol
                perfil.save(update_fields=['rol'])

        # Limpia usuario legado de cajero si existia de versiones anteriores.
        User.objects.filter(username='cajero').delete()

        for i in range(1, 11):
            Mesa.objects.get_or_create(numero_mesa=i)

        productos = {
            'Pepperoni': ('pizza', Decimal('14.99')),
            'Hawaiana': ('pizza', Decimal('13.99')),
            'Champinon': ('pizza', Decimal('13.49')),
            'Queso': ('pizza', Decimal('12.99')),
            'Coca Cola': ('bebida', Decimal('2.99')),
            'Coca Zero': ('bebida', Decimal('2.99')),
            'Manzanita': ('bebida', Decimal('2.79')),
            'Limonada': ('bebida', Decimal('2.49')),
            'Jamaica': ('bebida', Decimal('2.49')),
            'Horchata': ('bebida', Decimal('2.49')),
            'Tiramisu': ('postre', Decimal('6.99')),
            'Panna Cotta': ('postre', Decimal('5.99')),
            'Combo Individual': ('combo', Decimal('15.99')),
            'Combo En Pareja': ('combo', Decimal('27.99')),
            'Combo Familiar': ('combo', Decimal('39.99')),
        }
        producto_map = {}
        for nombre, (tipo, precio) in productos.items():
            producto, _ = Producto.objects.get_or_create(
                nombre=nombre,
                defaults={'tipo': tipo, 'precio': precio, 'activo': True},
            )
            if producto.tipo != tipo or producto.precio != precio:
                producto.tipo = tipo
                producto.precio = precio
                producto.activo = True
                producto.save(update_fields=['tipo', 'precio', 'activo'])
            producto_map[nombre] = producto

        ingredientes = {
            'Masa': ('pieza', Decimal('100'), Decimal('15')),
            'Salsa': ('porcion', Decimal('120'), Decimal('20')),
            'Queso': ('porcion', Decimal('180'), Decimal('30')),
            'Pepperoni': ('porcion', Decimal('80'), Decimal('10')),
            'Jamon': ('porcion', Decimal('80'), Decimal('10')),
            'Pina': ('porcion', Decimal('60'), Decimal('10')),
            'Champinon': ('porcion', Decimal('60'), Decimal('10')),
            'Refresco': ('pieza', Decimal('120'), Decimal('20')),
            'Tiramisu': ('pieza', Decimal('30'), Decimal('5')),
            'Panna Cotta': ('pieza', Decimal('30'), Decimal('5')),
        }

        ingrediente_map = {}
        for nombre, (unidad, stock_actual, stock_minimo) in ingredientes.items():
            ingrediente, _ = Ingrediente.objects.get_or_create(
                nombre=nombre,
                defaults={
                    'unidad': unidad,
                    'stock_actual': stock_actual,
                    'stock_minimo': stock_minimo,
                },
            )
            ingrediente_map[nombre] = ingrediente

        recetas = {
            'Pepperoni': [('Masa', Decimal('1')), ('Salsa', Decimal('1')), ('Queso', Decimal('1')), ('Pepperoni', Decimal('1'))],
            'Hawaiana': [('Masa', Decimal('1')), ('Salsa', Decimal('1')), ('Queso', Decimal('1')), ('Jamon', Decimal('1')), ('Pina', Decimal('1'))],
            'Champinon': [('Masa', Decimal('1')), ('Salsa', Decimal('1')), ('Queso', Decimal('1')), ('Champinon', Decimal('1'))],
            'Queso': [('Masa', Decimal('1')), ('Salsa', Decimal('1')), ('Queso', Decimal('1.5'))],
            'Coca Cola': [('Refresco', Decimal('1'))],
            'Coca Zero': [('Refresco', Decimal('1'))],
            'Manzanita': [('Refresco', Decimal('1'))],
            'Limonada': [('Refresco', Decimal('1'))],
            'Jamaica': [('Refresco', Decimal('1'))],
            'Horchata': [('Refresco', Decimal('1'))],
            'Tiramisu': [('Tiramisu', Decimal('1'))],
            'Panna Cotta': [('Panna Cotta', Decimal('1'))],
            'Combo Individual': [('Masa', Decimal('1')), ('Salsa', Decimal('1')), ('Queso', Decimal('1')), ('Refresco', Decimal('1'))],
            'Combo En Pareja': [('Masa', Decimal('2')), ('Salsa', Decimal('2')), ('Queso', Decimal('2')), ('Refresco', Decimal('2'))],
            'Combo Familiar': [('Masa', Decimal('2')), ('Salsa', Decimal('2')), ('Queso', Decimal('2')), ('Refresco', Decimal('3'))],
        }

        for producto_nombre, ingredientes_lista in recetas.items():
            producto = producto_map[producto_nombre]
            for ing_nombre, cantidad in ingredientes_lista:
                ingrediente = ingrediente_map[ing_nombre]
                RecetaProducto.objects.update_or_create(
                    producto=producto,
                    ingrediente=ingrediente,
                    defaults={'cantidad': cantidad},
                )

        self.stdout.write(self.style.SUCCESS('Datos iniciales cargados correctamente.'))
