import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Alert, Empty, Modal, PageHeader, Status, date, money } from '../components/UI';
import hero from '../assets/travel-hero.png';

const paymentMethods = [
  { key: 'QRIS', icon: 'QR', label: 'QRIS', description: 'Scan and pay with your wallet or mobile banking app.' },
  { key: 'Transfer Bank', icon: 'BNK', label: 'Transfer Bank', description: 'Choose a bank account and upload payment proof.' },
  { key: 'Debit/Kredit', icon: 'CARD', label: 'Debit/Kredit', description: 'Simulate card payment without storing sensitive data.' },
];
const bankOptions = [
  { key: 'BCA', icon: 'BCA', account: '1234567890' },
  { key: 'Mandiri', icon: 'MDR', account: '9876543210' },
  { key: 'BRI', icon: 'BRI', account: '1122334455' },
  { key: 'BNI', icon: 'BNI', account: '5566778899' },
];
const accountName = 'Wanderly Travel';

export function BookingPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [numParticipants, setNumParticipants] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (type !== 'trip') {
      navigate('/explore');
      return;
    }
    api.get(`/trips/${id}`)
      .then(({ data }) => setItem(data.data.trip))
      .catch(() => navigate('/explore'));
  }, [id, type, navigate]);
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const payload = {
        booking_type: 'trip',
        trip_id: item._id,
        qty: Number(numParticipants),
      };
      await api.post('/bookings', payload); navigate('/bookings');
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  };
  if (!item) return <div className="page-loader">Preparing booking...</div>;
  return <section className="section narrow"><PageHeader eyebrow="ALMOST THERE" title="Complete your booking" text="Review the fixed trip schedule and choose the number of guests." /><div className="checkout-layout"><form className="content-card form-stack" onSubmit={submit}><Alert error={error} /><div className="trip-date-readonly"><span>Trip Date</span><strong>{date(item.start_date || item.departure_date)} — {date(item.end_date || item.start_date || item.departure_date)}</strong><small>The schedule is set by the trip organizer.</small></div><label>Number of guests<input required type="number" min="1" max={item.quota} value={numParticipants} onChange={(e) => setNumParticipants(e.target.value)} /></label><div className="total-row"><span>Total</span><strong>{money(item.price * numParticipants)}</strong></div><button className="button wide" disabled={submitting}>{submitting ? 'Creating booking...' : 'Confirm booking'}</button></form><aside className="checkout-card"><img src={item.image_url || hero} /><p className="eyebrow">trip</p><h2>{item.title}</h2><p>{date(item.start_date || item.departure_date)} — {date(item.end_date || item.start_date || item.departure_date)}</p><strong>{money(item.price)} / guest</strong></aside></div></section>;
}

export function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('');
  const [payment, setPayment] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewedTripIds, setReviewedTripIds] = useState(new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    const [bookingResponse, reviewResponse] = await Promise.all([
      api.get('/bookings/my', { params: filter ? { status: filter } : {} }),
      api.get('/reviews/my'),
    ]);
    setBookings(bookingResponse.data.data.bookings);
    setReviewedTripIds(
      new Set(reviewResponse.data.data.reviews.map((item) => item.trip_id?._id || item.trip_id))
    );
  };
  useEffect(() => { load(); }, [filter]);
  const cancel = async (id) => { await api.patch(`/bookings/${id}/cancel`); load(); };
  const pay = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { method: payment.method, payment_proof: payment.proof };
    if (payment.method === 'Transfer Bank') payload.bank_name = payment.bank_name;
    if (payment.method === 'Debit/Kredit') {
      const cardNumber = String(payment.card_number || '').replace(/\s+/g, '');
      if (!/^\d+$/.test(cardNumber)) return setError('Card number must contain digits only.');
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiry || '')) return setError('Expiry must use MM/YY format.');
      if (!/^\d{3,4}$/.test(payment.cvv || '')) return setError('CVV must be 3-4 digits.');
      payload.card_number = cardNumber;
      payload.expiry = payment.expiry;
      payload.cvv = payment.cvv;
    }
    try { await api.post(`/bookings/${payment.id}/payment`, payload); setPayment(null); setMessage('Payment submitted for verification.'); load(); }
    catch (err) { setError(err.response?.data?.message || 'Payment failed.'); }
  };
  const submitReview = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/reviews', {
        booking_id: review.booking._id,
        trip_id: review.booking.trip_id._id,
        rating: Number(review.rating),
        comment: review.comment,
      });
      setReview(null);
      setMessage('Review shared successfully. Thank you!');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Review could not be submitted.');
    }
  };
  return <section className="section"><PageHeader eyebrow="YOUR JOURNEYS" title="My bookings" text="Keep track of every upcoming and completed escape." action={<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All status</option>{['pending','confirmed','completed','cancelled'].map(x => <option key={x}>{x}</option>)}</select>} /><Alert success={message} error={error} />{bookings.length ? <div className="booking-list">{bookings.map((b) => { const item = b.trip_id || b.destination_id; const schedule = b.trip_id ? `${date(b.trip_id.start_date || b.trip_id.departure_date)} — ${date(b.trip_id.end_date || b.trip_id.start_date || b.trip_id.departure_date)}` : date(b.visit_date); const canReview = b.booking_type === 'trip' && ['confirmed', 'completed'].includes(b.status); const alreadyReviewed = b.trip_id && reviewedTripIds.has(b.trip_id._id); return <article key={b._id}><img src={item?.image_url || hero} /><div className="booking-info"><div><p className="eyebrow">{b.booking_type}</p><h3>{item?.title || item?.city}</h3><p>{schedule} · {b.qty} guest(s)</p></div><div><Status value={b.status} /><strong>{money(b.total_price)}</strong></div></div><div className="booking-actions">{b.status === 'pending' && !b.payment_id && <button className="button small" onClick={() => { setError(''); setPayment({ id: b._id, method: 'QRIS', proof: '', total: b.total_price, bank_name: 'BCA', card_number: '', card_holder: '', expiry: '', cvv: '' }); }}>Pay now</button>}{b.status === 'pending' && <button className="button ghost small" onClick={() => cancel(b._id)}>Cancel</button>}{b.payment_id && <Status value={b.payment_id.status} />}{canReview && !alreadyReviewed && <button className="button small" onClick={() => { setError(''); setReview({ booking: b, rating: 5, comment: '' }); }}>Write review</button>}{alreadyReviewed && <span className="review-note success">Reviewed</span>}{!canReview && b.booking_type === 'trip' && <span className="review-note">Review available after payment is verified and booking is confirmed.</span>}</div></article>; })}</div> : <Empty title="No bookings yet" text="Your next beautiful journey starts on the explore page." />}
    {payment && <PaymentModal payment={payment} setPayment={setPayment} onSubmit={pay} onClose={() => setPayment(null)} />}
    {review && <Modal title={`Review ${review.booking.trip_id.title}`} onClose={() => setReview(null)}><form className="form-stack review-modal-form" onSubmit={submitReview}><p>Your review will be linked automatically to this booking. No booking ID is needed.</p><label>Rating<select value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>)}</select></label><label>Comment<textarea required rows="5" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} placeholder="Share what made this trip memorable..." /></label><button className="button">Submit review</button></form></Modal>}
  </section>;
}

function PaymentModal({ payment, setPayment, onSubmit, onClose }) {
  const selectedBank = bankOptions.find((bank) => bank.key === payment.bank_name) || bankOptions[0];
  const setMethod = (method) => setPayment({
    ...payment,
    method,
    bank_name: payment.bank_name || 'BCA',
  });

  return <div className="modal-backdrop"><form className="modal payment-modal form-stack" onSubmit={onSubmit}><div className="modal-head"><div><p className="eyebrow">SECURE CHECKOUT</p><h2>Submit payment</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
    <div className="payment-total"><span>Total payment</span><strong>{money(payment.total || 0)}</strong></div>
    <div className="payment-method-grid">{paymentMethods.map((method) => <button type="button" key={method.key} className={payment.method === method.key ? 'selected' : ''} onClick={() => setMethod(method.key)}><span>{method.icon}</span><div><strong>{method.label}</strong><small>{method.description}</small></div></button>)}</div>
    <section className="payment-detail-panel"><h3>Payment details</h3>
      {payment.method === 'QRIS' && <div className="payment-instructions qris-box"><div className="qris-code">QRIS</div><div><strong>Scan QRIS Wanderly Travel</strong><p>Open your e-wallet or mobile banking app, scan QRIS, pay the exact total, then submit your payment proof URL.</p></div></div>}
      {payment.method === 'Transfer Bank' && <><div className="bank-grid">{bankOptions.map((bank) => <button type="button" key={bank.key} className={payment.bank_name === bank.key ? 'selected' : ''} onClick={() => setPayment({ ...payment, bank_name: bank.key })}><span>{bank.icon}</span><strong>{bank.key}</strong></button>)}</div><div className="account-box"><div><span>Bank</span><strong>{selectedBank.key}</strong></div><div><span>Nomor Rekening</span><strong>{selectedBank.account}</strong></div><div><span>Nama Rekening</span><strong>{accountName}</strong></div></div></>}
      {payment.method === 'Debit/Kredit' && <div className="card-form"><label className="span-2">Card number<input inputMode="numeric" value={payment.card_number} onChange={(e) => setPayment({ ...payment, card_number: e.target.value })} placeholder="4111 1111 1111 1111" /></label><label className="span-2">Card holder name<input value={payment.card_holder} onChange={(e) => setPayment({ ...payment, card_holder: e.target.value })} placeholder="Name on card" /></label><label>Expiry date<input value={payment.expiry} onChange={(e) => setPayment({ ...payment, expiry: e.target.value })} placeholder="MM/YY" /></label><label>CVV<input inputMode="numeric" value={payment.cvv} onChange={(e) => setPayment({ ...payment, cvv: e.target.value })} placeholder="123" /></label><p>Only the last 4 digits are sent for this demo payment. Full card data is not stored.</p></div>}
    </section>
    <label className="payment-proof-field">Payment proof URL<input required value={payment.proof} onChange={(e) => setPayment({ ...payment, proof: e.target.value })} placeholder="https://..." /></label>
    <button className="button wide">Submit payment</button>
  </form></div>;
}

export function WishlistPage() {
  const [items, setItems] = useState([]);
  const load = () => api.get('/wishlists').then(({ data }) => setItems(data.data.wishlist));
  useEffect(() => { load(); }, []);
  const remove = (id) => api.delete(`/wishlists/${id}`).then(load);
  return <section className="wishlist-page">
    <header className="wishlist-hero">
      <p className="eyebrow">SAVED COLLECTION</p>
      <h1>Your Travel Wishlist</h1>
      <p>A curated collection of trips and destinations you want to return to.</p>
    </header>
    {items.length ? <div className="wishlist-grid">{items.map((entry) => {
      const item = entry.trip_id || entry.destination_id;
      const type = entry.trip_id ? 'trip' : 'destination';
      return <article className="wishlist-card" key={entry._id}>
        <img src={item?.image_url || hero} alt={item?.title || item?.city || type} />
        <div className="wishlist-overlay" />
        <div className="wishlist-content">
          <p>{type}</p>
          <h3>{item?.title || item?.city}</h3>
          <strong>{money(item?.price)}</strong>
          <div>
            <Link className="wishlist-action view" to={type === 'trip' ? `/trips/${item?._id}` : `/destinations/${item?._id}`}>View Experience →</Link>
            <button className="wishlist-action remove" onClick={() => remove(entry._id)}>Remove</button>
          </div>
        </div>
      </article>;
    })}</div> : <div className="wishlist-empty"><h2>No saved journeys yet.</h2><p>Start exploring and save the places that catch your heart.</p><Link to="/explore#destinations">Explore destinations →</Link></div>}
  </section>;
}
