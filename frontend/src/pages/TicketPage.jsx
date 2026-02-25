import { useEffect, useState } from 'react';
import { CheckCircle2, QrCode, ReceiptText } from 'lucide-react';
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
        <p className="error-box">{error}</p>
        <Link className="secondary-link" to="/">
          Volver al POS
        </Link>
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
      <section className="payment-card">
        <CheckCircle2 size={84} className="success-icon" />
        <h1>Pago completado</h1>
        <p>Gracias por tu compra. Tu orden se enviara a produccion.</p>

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
          <div className="total-row">
            <span>Total:</span>
            <strong>{money(ticket.total)}</strong>
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