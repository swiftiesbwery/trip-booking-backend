import { useEffect, useState } from 'react';
import api from '../services/api';
import { Alert, Empty, Modal, PageHeader, Status, date, money } from '../components/UI';

const unwrap = (promise, key) => promise.then(({ data }) => data.data[key]);
const sortOptions = [
  ['name_asc', 'A-Z'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
];

function SortSelect({ value, onChange }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)}>{sortOptions.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>;
}

function AdminPage({ eyebrow, title, text, action, children }) {
  return <section><PageHeader eyebrow={eyebrow} title={title} text={text} action={action} />{children}</section>;
}

function DataTable({ headers, children, empty = 'No data found' }) {
  return <div className="table-card"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>{!children?.length && <Empty title={empty} />}</div>;
}

export function AdminDashboard() {
  const [data, setData] = useState({ trips: [], destinations: [], bookings: [], payments: [], users: [] });
  useEffect(() => { Promise.all([
    unwrap(api.get('/admin/trips?limit=5'), 'trips'), unwrap(api.get('/admin/destinations?limit=5'), 'destinations'),
    unwrap(api.get('/admin/bookings?limit=5'), 'bookings'), unwrap(api.get('/admin/payments?limit=5'), 'payments'),
    unwrap(api.get('/admin/users?limit=5'), 'users'),
  ]).then(([trips,destinations,bookings,payments,users]) => setData({ trips,destinations,bookings,payments,users })); }, []);
  const revenue = data.bookings.filter(x => ['confirmed','completed'].includes(x.status)).reduce((sum, x) => sum + x.total_price, 0);
  return <AdminPage eyebrow="WELCOME BACK" title="Dashboard overview" text="A calm view of everything happening at Wanderly.">
    <div className="stats-grid"><Stat label="Total trips" value={data.trips.length} tone="pink" /><Stat label="Destinations" value={data.destinations.length} tone="purple" /><Stat label="Recent bookings" value={data.bookings.length} tone="yellow" /><Stat label="Revenue snapshot" value={money(revenue)} tone="green" /></div>
    <div className="admin-grid"><div className="panel"><h2>Recent bookings</h2>{data.bookings.map(x => <div className="activity" key={x._id}><div className="avatar">{x.user_id?.name?.[0]}</div><div><strong>{x.user_id?.name}</strong><span>{x.trip_id?.title || x.destination_id?.city}</span></div><Status value={x.status} /></div>)}</div><div className="panel"><h2>Payments to check</h2>{data.payments.map(x => <div className="activity" key={x._id}><div className="avatar">$</div><div><strong>{money(x.amount)}</strong><span>{x.method}</span></div><Status value={x.status} /></div>)}</div></div>
  </AdminPage>;
}
function Stat({ label, value, tone }) { return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>Live database snapshot</small></article>; }

export function AdminTrips() {
  const blank = { title: '', country: 'Indonesia', city: '', category: 'domestic', image_url: '', price: '', quota: '', start_date: '', end_date: '', destinations: [] };
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState('name_asc');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const load = () => unwrap(api.get('/admin/trips',{params:{limit:100,sort}}), 'trips').then(setItems);
  useEffect(() => {
    load();
    unwrap(api.get('/admin/destinations',{params:{limit:100,sort:'name_asc'}}), 'destinations').then(setDestinationOptions);
  }, [sort]);

  const selectedIds = (trip) =>
    (trip.destinations || []).map((item) => item.destination_id?._id || item.destination_id);

  const openEdit = (trip) => setModal({
    ...trip,
    country: trip.country || 'Indonesia',
    city: trip.city || '',
    category: trip.category || 'domestic',
    start_date: trip.start_date?.slice(0, 10),
    end_date: trip.end_date?.slice(0, 10),
    destinations: selectedIds(trip),
  });

  const toggleDestination = (destinationId) => {
    const selected = modal.destinations || [];
    setModal({
      ...modal,
      destinations: selected.includes(destinationId)
        ? selected.filter((id) => id !== destinationId)
        : [...selected, destinationId],
    });
  };

  const save = async (e) => {
    e.preventDefault();
    const body = {
      ...modal,
      price: Number(modal.price),
      quota: Number(modal.quota),
      destinations: modal.destinations.map((destination_id, index) => ({
        destination_id,
        visit_order: index + 1,
        notes: '',
      })),
    };
    try {
      modal._id
        ? await api.patch(`/admin/trips/${modal._id}`, body)
        : await api.post('/admin/trips', body);
      setModal(null);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message);
    }
  };
  const remove = id => api.delete(`/admin/trips/${id}`).then(load).catch(e => setMessage(e.response?.data?.message));
  return <AdminPage eyebrow="CATALOG" title="Manage trips" text="Create beautiful journeys and keep every detail current." action={<div className="admin-actions"><SortSelect value={sort} onChange={setSort} /><button className="button" onClick={() => setModal(blank)}>+ New trip</button></div>}><Alert error={message} /><DataTable headers={['Trip','Location','Dates','Price','Quota','Status','Actions']}>{items.map(x => <tr key={x._id}><td><strong>{x.title}</strong><small>{x.destinations?.length} destinations</small></td><td>{x.country || 'Indonesia'}{x.city ? <small>{x.city}</small> : null}<div className="catalog-meta"><span>{x.category || 'domestic'}</span></div></td><td>{date(x.start_date)}<small>to {date(x.end_date)}</small></td><td>{money(x.price)}</td><td>{x.quota}</td><td><Status value={x.status || 'active'} /></td><td><button onClick={() => openEdit(x)}>Edit</button><button className="danger-link" onClick={() => remove(x._id)}>Delete</button></td></tr>)}</DataTable>
    {modal && <Modal title={modal._id ? 'Edit trip' : 'Create trip'} onClose={() => setModal(null)}><form className="form-grid" onSubmit={save}><label>Title<input required value={modal.title} onChange={e => setModal({...modal,title:e.target.value})} /></label><label>Category<select value={modal.category || 'domestic'} onChange={e => setModal({...modal,category:e.target.value})}><option value="domestic">Domestic</option><option value="international">International</option></select></label><label>Country<input required value={modal.country || ''} onChange={e => setModal({...modal,country:e.target.value})} /></label><label>City<input value={modal.city || ''} onChange={e => setModal({...modal,city:e.target.value})} /></label><label>Image URL<input value={modal.image_url || ''} onChange={e => setModal({...modal,image_url:e.target.value})} /></label><label>Price<input required type="number" value={modal.price} onChange={e => setModal({...modal,price:e.target.value})} /></label><label>Quota<input required type="number" value={modal.quota} onChange={e => setModal({...modal,quota:e.target.value})} /></label><label>Start date<input required type="date" value={modal.start_date} onChange={e => setModal({...modal,start_date:e.target.value})} /></label><label>End date<input required type="date" value={modal.end_date} onChange={e => setModal({...modal,end_date:e.target.value})} /></label>
      <fieldset className="destination-picker span-2">
        <legend>Choose destinations</legend>
        <p>Select one or more destinations. The selection order becomes the visit order.</p>
        {destinationOptions.length ? <div className="destination-options">{destinationOptions.map((destination) => {
          const order = modal.destinations.indexOf(destination._id);
          return <label className={order >= 0 ? 'selected' : ''} key={destination._id}>
            <input type="checkbox" checked={order >= 0} onChange={() => toggleDestination(destination._id)} />
            <span className="destination-order">{order >= 0 ? order + 1 : '+'}</span>
            <span><strong>{destination.city}</strong><small>{destination.province}, {destination.country}</small></span>
          </label>;
        })}</div> : <p className="destination-empty">Create a destination first before connecting it to a trip.</p>}
      </fieldset>
      <button className="button span-2">Save trip</button></form></Modal>}
  </AdminPage>;
}

export function AdminDestinations() {
  const blank = { city: '', province: '', country: 'Indonesia', category: 'domestic', image_url: '', price: '' };
  const [items, setItems] = useState([]); const [modal, setModal] = useState(null); const [message, setMessage] = useState(''); const [sort, setSort] = useState('name_asc');
  const load = () => unwrap(api.get('/admin/destinations',{params:{limit:100,sort}}), 'destinations').then(setItems);
  useEffect(() => { load(); }, [sort]);
  const openEdit = (destination) => setModal({ ...destination, destinationId: destination._id, category: destination.category || 'domestic' });
  const save = async e => { e.preventDefault(); try { const destinationId = modal.destinationId || modal._id; const body = { city: modal.city, province: modal.province, country: modal.country, category: modal.category || 'domestic', image_url: modal.image_url || modal.imageUrl || '', price: Number(modal.price) }; console.log('Updating destination:', destinationId, body); destinationId ? await api.put(`/admin/destinations/${destinationId}`, body) : await api.post('/admin/destinations', body); setModal(null); await load(); } catch(e){ console.log('Update destination error response:', e.response?.data || e.message); setMessage(e.response?.data?.message || 'Gagal menyimpan destination'); } };
  const remove = id => api.delete(`/admin/destinations/${id}`).then(load).catch(e => setMessage(e.response?.data?.message));
  return <AdminPage eyebrow="PLACES" title="Manage destinations" text="Maintain the places travelers can discover and book." action={<div className="admin-actions"><SortSelect value={sort} onChange={setSort} /><button className="button" onClick={() => setModal(blank)}>+ New destination</button></div>}><Alert error={message} /><DataTable headers={['Destination','Location','Category','Price','Actions']}>{items.map(x => <tr key={x._id}><td><strong>{x.city}</strong><small>{x.country}</small></td><td>{x.province}<small>{x.city}</small></td><td><div className="catalog-meta"><span>{x.category || 'domestic'}</span></div></td><td>{money(x.price)}</td><td><button onClick={() => openEdit(x)}>Edit</button><button className="danger-link" onClick={() => remove(x._id)}>Delete</button></td></tr>)}</DataTable>
  {modal && <Modal title={modal._id ? 'Edit destination' : 'Create destination'} onClose={() => setModal(null)}><form className="form-grid" onSubmit={save}><label>City<input required value={modal.city || ''} onChange={e => setModal({...modal,city:e.target.value})} /></label><label>Province<input required value={modal.province || ''} onChange={e => setModal({...modal,province:e.target.value})} /></label><label>Country<input required value={modal.country || ''} onChange={e => setModal({...modal,country:e.target.value})} /></label><label>Category<select value={modal.category || 'domestic'} onChange={e => setModal({...modal,category:e.target.value})}><option value="domestic">Domestic</option><option value="international">International</option></select></label><label>Image URL<input value={modal.image_url || ''} onChange={e => setModal({...modal,image_url:e.target.value})} /></label><label>Price<input required type="number" value={modal.price} onChange={e => setModal({...modal,price:e.target.value})} /></label><button className="button span-2">Save destination</button></form></Modal>}</AdminPage>;
}

export function AdminBookings() {
  const [items,setItems]=useState([]); const [filter,setFilter]=useState('');
  const load=()=>unwrap(api.get('/admin/bookings',{params:{limit:100,...(filter&&{status:filter})}}),'bookings').then(setItems);
  useEffect(()=>{load();},[filter]);
  const change=(id,status)=>api.patch(`/admin/bookings/${id}/status`,{status}).then(load);
  return <AdminPage eyebrow="OPERATIONS" title="Manage bookings" text="Review reservations and move them through each journey stage." action={<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All status</option>{['pending','confirmed','completed','cancelled'].map(x=><option key={x}>{x}</option>)}</select>}><DataTable headers={['Customer','Booking','Visit','Total','Status','Update']}>{items.map(x=><tr key={x._id}><td><strong>{x.user_id?.name}</strong><small>{x.user_id?.email}</small></td><td><strong>{x.trip_id?.title||x.destination_id?.city}</strong><small>{x.booking_type} · {x.qty} guest(s)</small></td><td>{date(x.visit_date)}</td><td>{money(x.total_price)}</td><td><Status value={x.status}/></td><td><select value={x.status} onChange={e=>change(x._id,e.target.value)}>{['pending','confirmed','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</DataTable></AdminPage>;
}

export function AdminPayments() {
  const [items,setItems]=useState([]); const [filter,setFilter]=useState('');
  const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const load=()=>unwrap(api.get('/admin/payments',{params:{limit:100,...(filter&&{status:filter})}}),'payments').then(setItems);
  useEffect(()=>{
    load();
    const onFocus = () => load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  },[filter]);
  const change=async(payment,status)=>{
    const paymentId = payment.id || payment._id;
    setMessage('');
    setError('');
    try {
      await api.patch(`/admin/payments/${paymentId}/status`,{status});
      await load();
      setMessage('Payment status updated.');
    } catch (err) {
      const text = err.response?.data?.message || 'Failed to update payment status.';
      console.error('Failed to update payment status', { paymentId, status, error: err });
      setError(text);
      alert(text);
    }
  };
  const proofHref = (proof) => proof?.startsWith('http') ? proof : `http://localhost:3000${proof}`;
  return <AdminPage eyebrow="FINANCE" title="Manage payments" text="Verify submitted payments and confirm bookings." action={<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All status</option>{['pending','checking','verified'].map(x=><option key={x}>{x}</option>)}</select>}><Alert success={message} error={error} /><DataTable headers={['Customer','Booking','Method','Amount','Proof','Status','Update']}>{items.map(x=><tr key={x._id}><td><strong>{x.user_id?.name}</strong><small>{x.user_id?.email}</small></td><td><Status value={x.booking_status || x.booking_id?.status}/></td><td><strong>{x.method}</strong><small>{x.bank_name || (x.card_last4 && `Card **** ${x.card_last4}`) || '-'}</small></td><td>{money(x.amount)}</td><td>{x.proof_url?<a href={proofHref(x.proof_url)} target="_blank" rel="noreferrer">View proof</a>:'-'}</td><td><Status value={x.status}/></td><td><select value={x.status} onChange={e=>change(x,e.target.value)}>{['pending','checking','verified'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</DataTable></AdminPage>;
}

export function AdminReviews() {
  const [items,setItems]=useState([]);
  const load=()=>unwrap(api.get('/admin/reviews?limit=100'),'reviews').then(setItems);
  useEffect(()=>{load();},[]);
  return <AdminPage eyebrow="COMMUNITY" title="Review monitoring" text="Monitor traveler feedback and experiences across every trip."><DataTable headers={['Traveler','Trip','Rating','Comment']}>{items.map(x=><tr key={x._id}><td><strong>{x.user_id?.name}</strong></td><td>{x.trip_id?.title}</td><td><span className="stars">{'★'.repeat(x.rating)}</span></td><td>{x.comment||'-'}</td></tr>)}</DataTable></AdminPage>;
}
