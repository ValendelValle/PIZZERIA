import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, QrCode, ReceiptText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { money } from '../utils/format';

function TicketPage() {
  const { folio } = useParams();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTicket() {
      try {
        const { data } = await client.get(`/tickets/${folio}/`);
        setTicket(data);
      } catch {
        setError('No se encontro el ticket solicitado.');
      }
    }

    loadTicket();
  }, [folio]);

  if (error) {
    return (
      <main className="screen narrow-screen">
        <section className="payment-card auth-card">
          <p className="error-box">{error}</p>
          <Link className="secondary-link" to="/">
            Volver al POS
          </Link>
        </section>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="screen narrow-screen">
        <p>Cargando ticket...</p>
      </main>
    );
  }

  return (
    <main className="screen narrow-screen">
      <section className="payment-card ticket-card">
        <CheckCircle2 size={84} className="success-icon" />
        <p className="section-kicker">Pedido recibido</p>
        <h1>Pago completado</h1>
        <p>Gracias por tu compra. Tu orden se enviara a produccion.</p>

        <div className="ticket-meta-chips">
          <span>
            <ReceiptText size={16} />
            Folio {ticket.folio}
          </span>
          <span>
            <Clock3 size={16} />
            {new Date(ticket.fecha_hora).toLocaleString('es-MX')}
          </span>
        </div>

        <article className="ticket-resume">
          <div>
            <span>Ticket ID:</span>
            <strong>{ticket.folio}</strong>
          </div>
          <div>
            <span>Mesa:</span>
            <strong>{ticket.mesa || 'Mostrador'}</strong>
          </div>
          <div>
            <span>Items:</span>
            <strong>{ticket.detalles.reduce((acc, detail) => acc + detail.cantidad, 0)}</strong>
          </div>
          <div>
            <span>Subtotal:</span>
            <strong>{money(ticket.subtotal)}</strong>
          </div>
          <div>
            <span>Impuesto:</span>
            <strong>{money(ticket.impuesto)}</strong>
          </div>
          <div className="total-row">
            <span>Total:</span>
            <strong>{money(ticket.total)}</strong>
          </div>
        </article>

        <article className="ticket-items">
          <div className="content-head">
            <div>
              <p className="section-kicker">Detalle del consumo</p>
              <h2>Productos registrados</h2>
            </div>
          </div>
          <div className="ticket-items__list">
            {ticket.detalles.map((detail, index) => (
              <div key={`${detail.producto}-${index}`} className="ticket-item">
                <div>
                  <strong>{detail.producto}</strong>
                  <p>
                    {detail.cantidad} x {money(detail.precio_unitario)}
                  </p>
                </div>
                <span>{money(detail.subtotal)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="qr-block">
          <p>
            <QrCode size={18} />
            Escanea para descargar tu ticket virtual
          </p>
          <img src={ticket.ticket.codigo_qr} alt="QR del ticket" />
          <a href={ticket.ticket.url_ticket} target="_blank" rel="noreferrer">
            <ReceiptText size={16} />
            Abrir ticket en web
          </a>
        </article>

        <Link className="pay-btn" to="/">
          Crear nueva orden
        </Link>
      </section>
    </main>
  );
}

export default TicketPage;
