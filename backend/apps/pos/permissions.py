from rest_framework.permissions import BasePermission
from .models import UsuarioPerfil


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser or user.is_staff:
        return UsuarioPerfil.Rol.ADMIN

    perfil = getattr(user, 'perfil', None)
    if perfil:
        return perfil.rol
    return None


class RolePermission(BasePermission):
    allowed_roles = ()
    message = 'No tienes permisos para acceder a este recurso.'

    def has_permission(self, request, view):
        return get_user_role(request.user) in self.allowed_roles


class IsProduccionOrAdmin(RolePermission):
    allowed_roles = (UsuarioPerfil.Rol.PRODUCCION, UsuarioPerfil.Rol.ADMIN)


class IsAdmin(RolePermission):
    allowed_roles = (UsuarioPerfil.Rol.ADMIN,)
