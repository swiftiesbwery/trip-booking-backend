import { Link } from 'react-router-dom';
import hero from '../assets/travel-hero.png';

export const money = (value = 0) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export const date = (value) =>
  value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : 'Flexible';

export function Status({ value }) {
  return <span className={`status ${value || 'pending'}`}>{value || 'pending'}</span>;
}

export function Empty({ title = 'Nothing here yet', text = 'New items will appear here.' }) {
  return <div className="empty"><div className="empty-orb">✦</div><h3>{title}</h3><p>{text}</p></div>;
}

export function Alert({ error, success }) {
  if (!error && !success) return null;
  return <div className={`alert ${error ? 'error' : 'success'}`}>{error || success}</div>;
}

export function TripCard({ trip, onWishlist, isWishlisted = false, wishlistBusy = false }) {
  const image = trip.image_url || trip.destinations?.[0]?.destination_id?.image_url || hero;
  const place = trip.destinations?.[0]?.destination_id;
  const location = trip.city || place?.city || place?.province || trip.country || place?.country || 'Indonesia';
  const rating = trip.rating?.avg || trip.rating_avg || trip.avg_rating || trip.average_rating || 'New';
  return (
    <article className="trip-card">
      <div className="trip-image">
        <img src={image} alt={trip.title} />
        <span className="floating-tag">{trip.category || 'Domestic'}</span>
        {onWishlist && (
          <button
            type="button"
            className={`heart ${isWishlisted ? 'active' : ''}`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={isWishlisted}
            disabled={wishlistBusy}
            onClick={() => onWishlist(trip._id)}
          >
            {isWishlisted ? '♥' : '♡'}
          </button>
        )}
      </div>
      <div className="trip-content">
        <div className="trip-card-head">
          <div>
            <h3>{trip.title}</h3>
            <p className="trip-location">{location}</p>
          </div>
          <span className="trip-rating">★ {rating}</span>
        </div>
        <div className="card-bottom">
          <div className="trip-price"><span>From</span><strong>{money(trip.price)}</strong></div>
        </div>
        <Link className="button small trip-see-button" to={`/trips/${trip._id}`}>View Experience</Link>
      </div>
    </article>
  );
}

export function PageHeader({ eyebrow, title, text, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

export function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div>;
}
