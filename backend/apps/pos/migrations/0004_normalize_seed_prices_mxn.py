from decimal import Decimal

from django.db import migrations


LEGACY_PRICE_MAP = {
    'Pepperoni': (Decimal('14.99'), Decimal('189.00')),
    'Hawaiana': (Decimal('13.99'), Decimal('179.00')),
    'Champinon': (Decimal('13.49'), Decimal('169.00')),
    'Queso': (Decimal('12.99'), Decimal('159.00')),
    'Coca Cola': (Decimal('2.99'), Decimal('32.00')),
    'Coca Zero': (Decimal('2.99'), Decimal('32.00')),
    'Manzanita': (Decimal('2.79'), Decimal('29.00')),
    'Limonada': (Decimal('2.49'), Decimal('34.00')),
    'Jamaica': (Decimal('2.49'), Decimal('28.00')),
    'Horchata': (Decimal('2.49'), Decimal('28.00')),
    'Tiramisu': (Decimal('6.99'), Decimal('79.00')),
    'Panna Cotta': (Decimal('5.99'), Decimal('69.00')),
    'Combo Individual': (Decimal('15.99'), Decimal('219.00')),
    'Combo En Pareja': (Decimal('27.99'), Decimal('389.00')),
    'Combo Familiar': (Decimal('39.99'), Decimal('499.00')),
}


def normalize_seed_prices(apps, schema_editor):
    Producto = apps.get_model('pos', 'Producto')

    for nombre, (legacy_price, new_price) in LEGACY_PRICE_MAP.items():
        Producto.objects.filter(nombre=nombre, precio=legacy_price).update(precio=new_price)


def reverse_normalize_seed_prices(apps, schema_editor):
    Producto = apps.get_model('pos', 'Producto')

    for nombre, (legacy_price, new_price) in LEGACY_PRICE_MAP.items():
        Producto.objects.filter(nombre=nombre, precio=new_price).update(precio=legacy_price)


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0003_adminaccion'),
    ]

    operations = [
        migrations.RunPython(normalize_seed_prices, reverse_normalize_seed_prices),
    ]
