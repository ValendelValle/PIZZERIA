import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

function UnauthorizedPage() {
  return (
    <main className="screen narrow-screen">
      <section className="payment-card auth-card">
        <div className="auth-card__icon auth-card__icon--danger">
          <ShieldAlert size={28} />
        </div>
        <p className="section-kicker auth-card__kicker">Permisos</p>
        <h1>Sin acceso</h1>
        <p>Tu rol no tiene permisos para entrar a esta seccion.</p>
        <Link className="pay-btn" to="/">
          Ir a inicio
        </Link>
      </section>
    </main>
  );
}

export default UnauthorizedPage;
