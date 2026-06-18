import { useEffect, useState } from 'react';
import api from '../services/api';
import { Alert, Empty, Modal, PageHeader, Status, date, money } from '../components/UI';

const unwrap = (promise, key) => promise.then(({ data }) => data.data[key]);
const unwrapPage = (promise, key) => promise.then(({ data }) => ({
  items: data.data[key],
  total: data.total ?? data.data[key].length,
}));
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

const createItineraryActivity = () => ({ time: '', title: '' });
const createItineraryDay = (day = 1) => ({ day, title: '', activities: [createItineraryActivity()] });
const normalizeItineraryDays = (days = []) =>
  (Array.isArray(days) ? days : [])
    .map((day, index) => ({
      day: Number(day.day) || index + 1,
      title: typeof day.title === 'string' ? day.title : '',
      activities: Array.isArray(day.activities)
        ? day.activities.map((activity) => ({
            time: typeof activity.time === 'string' ? activity.time : '',
            title: String(activity.title || activity.activity || ''),
          }))
        : [],
    }))
    .filter((day) => day.title || day.activities.length);

function ItineraryEditor({ days = [], onChange, legend = 'Recommended itinerary (optional)' }) {
  const updateDays = (nextDays) => onChange(nextDays);
  const updateDay = (dayIndex, patch) => {
    const next = days.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day));
    updateDays(next);
  };
  const deleteDay = (dayIndex) => updateDays(days.filter((_, index) => index !== dayIndex));
  const addDay = () => updateDays([...(days || []), createItineraryDay((days?.length || 0) + 1)]);
  const addActivity = (dayIndex) => {
    const next = days.map((day, index) =>
      index === dayIndex
        ? { ...day, activities: [...(day.activities || []), createItineraryActivity()] }
        : day
    );
    updateDays(next);
  };
  const updateActivity = (dayIndex, activityIndex, patch) => {
    const next = days.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        activities: (day.activities || []).map((activity, idx) =>
          idx === activityIndex ? { ...activity, ...patch } : activity
        ),
      };
    });
    updateDays(next);
  };
  const deleteActivity = (dayIndex, activityIndex) => {
    const next = days.map((day, index) =>
      index === dayIndex
        ? { ...day, activities: (day.activities || []).filter((_, idx) => idx !== activityIndex) }
        : day
    );
    updateDays(next);
  };

  return (
    <fieldset className="destination-picker span-2 itinerary-editor">
      <legend>{legend}</legend>
      <p>Use this as the reusable itinerary template for the trip.</p>
      <div className="itinerary-editor-list">
        {(days || []).length ? (
          days.map((day, dayIndex) => (
            <article className="itinerary-editor-day" key={`${dayIndex}-${day.day}`}>
              <div className="itinerary-editor-head">
                <label>
                  Day
                  <input
                    type="number"
                    min="1"
                    value={day.day}
                    onChange={(e) => updateDay(dayIndex, { day: Number(e.target.value) || dayIndex + 1 })}
                  />
                </label>
                <label>
                  Title
                  <input
                    value={day.title || ''}
                    onChange={(e) => updateDay(dayIndex, { title: e.target.value })}
                  />
                </label>
                <button type="button" className="danger-link" onClick={() => deleteDay(dayIndex)}>
                  Delete day
                </button>
              </div>
              <div className="itinerary-editor-activity-list">
                {(day.activities || []).length ? (
                  day.activities.map((activity, activityIndex) => (
                    <div className="itinerary-editor-activity" key={`${dayIndex}-${activityIndex}`}>
                      <label>
                        Time
                        <input
                          value={activity.time || ''}
                          onChange={(e) =>
                            updateActivity(dayIndex, activityIndex, { time: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Activity
                        <input
                          value={activity.title || ''}
                          onChange={(e) =>
                            updateActivity(dayIndex, activityIndex, { title: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="danger-link"
                        onClick={() => deleteActivity(dayIndex, activityIndex)}
                      >
                        Delete activity
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="destination-empty">No activities yet. Add one below.</p>
                )}
              </div>
              <button type="button" className="button ghost small" onClick={() => addActivity(dayIndex)}>
                + Add activity
              </button>
            </article>
          ))
        ) : (
          <p className="destination-empty">No itinerary days yet. Add one to begin.</p>
        )}
      </div>
      <button type="button" className="button ghost small" onClick={addDay}>
        + Add day
      </button>
    </fieldset>
  );
}

function ItineraryPreview({ days = [] }) {
  return (
    <div className="itinerary-preview span-2">
      {(days || []).length ? (
        days.map((day) => (
          <article className="itinerary-preview-day" key={`${day.day}-${day.title}`}>
            <div className="itinerary-preview-head">
              <strong>Day {day.day}</strong>
              {day.title ? <span>{day.title}</span> : null}
            </div>
            <ul>
              {(day.activities || []).map((activity, index) => (
                <li key={`${day.day}-${index}`}>
                  <strong>{activity.time || 'Any time'}</strong>
                  <span>{activity.title || activity.activity}</span>
                </li>
              ))}
            </ul>
          </article>
        ))
      ) : (
        <p className="destination-empty">No itinerary days available.</p>
      )}
    </div>
  );
}

const TRIP_STATUSES = ['active', 'inactive'];

export function AdminDashboard() {
  const [data, setData] = useState({
    trips: { items: [], total: 0 },
    destinations: { items: [], total: 0 },
    bookings: { items: [], total: 0 },
    payments: { items: [], total: 0 },
    users: { items: [], total: 0 },
  });
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([
    unwrapPage(api.get('/admin/trips?limit=5'), 'trips'), unwrapPage(api.get('/admin/destinations?limit=5'), 'destinations'),
    unwrapPage(api.get('/admin/bookings?limit=5'), 'bookings'), unwrapPage(api.get('/admin/payments?limit=100&status=verified'), 'payments'),
    unwrapPage(api.get('/admin/users?limit=5'), 'users'),
  ]).then(([trips,destinations,bookings,payments,users]) => {
    setError('');
    setData({ trips,destinations,bookings,payments,users });
  }).catch((err) => setError(err.response?.data?.message || 'Failed to load the admin dashboard')); }, []);
  const revenue = data.payments.items.reduce((sum, x) => sum + x.amount, 0);
  return <AdminPage eyebrow="WELCOME BACK" title="Dashboard overview" text="A calm view of everything happening at Wanderly.">
    <Alert error={error} />
    <div className="stats-grid"><Stat label="Total trips" value={data.trips.total} tone="pink" /><Stat label="Destinations" value={data.destinations.total} tone="purple" /><Stat label="Recent bookings" value={data.bookings.total} tone="yellow" /><Stat label="Revenue snapshot" value={money(revenue)} tone="green" /></div>
    <div className="admin-grid"><div className="panel"><h2>Recent bookings</h2>{data.bookings.items.map(x => <div className="activity" key={x._id}><div className="avatar">{x.user_id?.name?.[0]}</div><div><strong>{x.user_id?.name}</strong><span>{x.trip_id?.title || x.destination_id?.city}</span></div><Status value={x.status} /></div>)}</div><div className="panel"><h2>Verified payments</h2>{data.payments.items.map(x => <div className="activity" key={x._id}><div className="avatar">$</div><div><strong>{money(x.amount)}</strong><span>{x.method}</span></div><Status value={x.status} /></div>)}</div></div>
  </AdminPage>;
}
function Stat({ label, value, tone }) { return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>Live database snapshot</small></article>; }

export function AdminTrips() {
  const blank = {
    title: '',
    country: 'Indonesia',
    city: '',
    category: 'domestic',
    image_url: '',
    price: '',
    quota: '',
    start_date: '',
    end_date: '',
    destinations: [],
    recommended_itinerary: [],
    status: 'active',
  };
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState('name_asc');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = () =>
    unwrap(api.get('/admin/trips', { params: { limit: 100, sort } }), 'trips').then(setItems);
  useEffect(() => {
    load();
    unwrap(api.get('/admin/destinations', { params: { limit: 100, sort: 'name_asc' } }), 'destinations').then(setDestinationOptions);
  }, [sort]);

  const selectedIds = (trip) =>
    (trip.destinations || []).map((item) => item.destination_id?._id || item.destination_id);

  const openEdit = async (trip) => {
    try {
      setError('');
      const { data } = await api.get(`/admin/trips/${trip._id}`);
      const payload = data.data;
      setModal({
        ...payload.trip,
        country: payload.trip.country || 'Indonesia',
        city: payload.trip.city || '',
        category: payload.trip.category || 'domestic',
        status: payload.trip.status || 'active',
        start_date: payload.trip.start_date?.slice(0, 10),
        end_date: payload.trip.end_date?.slice(0, 10),
        destinations: selectedIds(payload.trip),
        recommended_itinerary: normalizeItineraryDays(payload.recommended_itinerary || []),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load trip details.');
    }
  };

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
    setMessage('');
    setError('');
    const body = {
      ...modal,
      price: Number(modal.price),
      quota: Number(modal.quota),
      destinations: (modal.destinations || []).map((destination_id, index) => ({
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
      await load();
      setMessage('Trip saved successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save trip.');
    }
  };

  const remove = (id) =>
    api.delete(`/admin/trips/${id}`).then(load).catch((e) => setError(e.response?.data?.message || 'Failed to delete trip.'));

  const changeStatus = async (trip, status) => {
    setMessage('');
    setError('');
    try {
      await api.patch(`/admin/trips/${trip._id}`, { status });
      await load();
      setMessage('Trip status updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update trip status.');
    }
  };

  return (
    <AdminPage
      eyebrow="CATALOG"
      title="Manage trips"
      text="Create beautiful journeys and keep every detail current."
      action={
        <div className="admin-actions">
          <SortSelect value={sort} onChange={setSort} />
          <button className="button compact" onClick={() => setModal(blank)}>
            + New trip
          </button>
        </div>
      }
    >
      <Alert success={message} error={error} />
      <DataTable headers={['Trip', 'Location', 'Dates', 'Price', 'Quota', 'Status', 'Actions']}>
        {items.map((x) => (
          <tr key={x._id}>
            <td>
              <strong>{x.title}</strong>
              <small>{x.destinations?.length} destinations</small>
            </td>
            <td>
              {x.country || 'Indonesia'}
              {x.city ? <small>{x.city}</small> : null}
              <div className="catalog-meta"><span>{x.category || 'domestic'}</span></div>
            </td>
            <td>{date(x.start_date)}<small>to {date(x.end_date)}</small></td>
            <td>{money(x.price)}</td>
            <td>{x.quota}</td>
            <td><Status value={x.status || 'active'} /></td>
            <td>
              <div className="admin-row-actions">
                <select value={x.status || 'active'} onChange={(e) => changeStatus(x, e.target.value)}>
                  {TRIP_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button onClick={() => openEdit(x)}>Edit</button>
                <button className="danger-link" onClick={() => remove(x._id)}>Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {modal && (
        <Modal title={modal._id ? 'Edit trip' : 'Create trip'} onClose={() => setModal(null)}>
          <form className="form-grid" onSubmit={save}>
            <label>Title<input required value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} /></label>
            <label>Category<select value={modal.category || 'domestic'} onChange={(e) => setModal({ ...modal, category: e.target.value })}><option value="domestic">Domestic</option><option value="international">International</option></select></label>
            <label>Status<select value={modal.status || 'active'} onChange={(e) => setModal({ ...modal, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label>Country<input required value={modal.country || ''} onChange={(e) => setModal({ ...modal, country: e.target.value })} /></label>
            <label>City<input value={modal.city || ''} onChange={(e) => setModal({ ...modal, city: e.target.value })} /></label>
            <label>Image URL<input value={modal.image_url || ''} onChange={(e) => setModal({ ...modal, image_url: e.target.value })} /></label>
            <label>Price<input required type="number" value={modal.price} onChange={(e) => setModal({ ...modal, price: e.target.value })} /></label>
            <label>Quota<input required type="number" value={modal.quota} onChange={(e) => setModal({ ...modal, quota: e.target.value })} /></label>
            <label>Start date<input required type="date" value={modal.start_date} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} /></label>
            <label>End date<input required type="date" value={modal.end_date} onChange={(e) => setModal({ ...modal, end_date: e.target.value })} /></label>
            <fieldset className="destination-picker span-2">
              <legend>Choose destinations</legend>
              <p>Select one or more destinations. The selection order becomes the visit order.</p>
              {destinationOptions.length ? (
                <div className="destination-options">
                  {destinationOptions.map((destination) => {
                    const order = (modal.destinations || []).indexOf(destination._id);
                    return (
                      <label className={order >= 0 ? 'selected' : ''} key={destination._id}>
                        <input type="checkbox" checked={order >= 0} onChange={() => toggleDestination(destination._id)} />
                        <span className="destination-order">{order >= 0 ? order + 1 : '+'}</span>
                        <span><strong>{destination.city}</strong><small>{destination.province}, {destination.country}</small></span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="destination-empty">Create a destination first before connecting it to a trip.</p>
              )}
            </fieldset>
            <ItineraryEditor
              days={modal.recommended_itinerary || []}
              onChange={(nextDays) => setModal({ ...modal, recommended_itinerary: nextDays })}
            />
            <button className="button span-2">Save trip</button>
          </form>
        </Modal>
      )}
    </AdminPage>
  );
}

export function AdminItineraries() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    unwrap(api.get('/admin/itineraries', { params: { limit: 100 } }), 'itineraries')
      .then(setItems)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load itineraries.'));

  useEffect(() => {
    load();
  }, []);

  const openView = async (itinerary) => {
    try {
      setError('');
      const { data } = await api.get(`/admin/itineraries/${itinerary._id}`);
      setModal({ mode: 'view', ...data.data.itinerary });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load itinerary details.');
    }
  };

  const openEdit = async (itinerary) => {
    try {
      setError('');
      const { data } = await api.get(`/admin/itineraries/${itinerary._id}`);
      setModal({ mode: 'edit', ...data.data.itinerary });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load itinerary details.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!modal?._id) return;
    setMessage('');
    setError('');
    try {
      await api.patch(`/admin/itineraries/${modal._id}`, { days: modal.days || [] });
      await load();
      setMessage('Itinerary updated successfully.');
      setModal(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update itinerary.');
    }
  };

  const close = () => setModal(null);

  return (
    <AdminPage
      eyebrow="JOURNEYS"
      title="Itineraries"
      text="Review and adjust every itinerary submitted by travelers."
    >
      <Alert success={message} error={error} />
      <DataTable headers={['Booking ID', 'User', 'Trip', 'Type', 'Status', 'Created At', 'Action']} empty="No itineraries found">
        {items.map((item) => {
          const bookingId = item.booking?._id || item.booking_id;
          const userName = item.user_name || item.booking?.user_id?.name || '-';
          const tripTitle = item.trip_title || item.booking?.trip_id?.title || '-';
          return (
            <tr key={item._id}>
              <td>
                <strong>{bookingId}</strong>
                <small>{item.booking_status || item.booking?.status || '-'}</small>
              </td>
              <td>
                <strong>{userName}</strong>
                <small>{item.user_email || item.booking?.user_id?.email || '-'}</small>
              </td>
              <td>
                <strong>{tripTitle}</strong>
                <small>{item.booking?.trip_id?.city || item.booking?.trip_id?.country || '-'}</small>
              </td>
              <td>{item.type}</td>
              <td><Status value={item.status || 'Submitted'} /></td>
              <td>{date(item.createdAt)}</td>
              <td>
                <div className="admin-row-actions">
                  <button onClick={() => openView(item)}>View</button>
                  <button onClick={() => openEdit(item)}>Edit</button>
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>

      {modal && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit itinerary' : 'View itinerary'}
          onClose={close}
        >
          <div className="itinerary-admin-modal">
            <div className="itinerary-admin-summary">
              <div><span>Trip Title</span><strong>{modal.trip_title || modal.trip?.title || '-'}</strong></div>
              <div><span>User Name</span><strong>{modal.user_name || modal.user?.name || '-'}</strong></div>
              <div><span>Booking Status</span><strong>{modal.booking_status || modal.booking?.status || '-'}</strong></div>
              <div><span>Payment Status</span><strong>{modal.payment_status || modal.payment?.status || '-'}</strong></div>
              <div><span>Itinerary Type</span><strong>{modal.type || '-'}</strong></div>
            </div>

            {modal.mode === 'edit' ? (
              <form className="form-stack" onSubmit={save}>
                <ItineraryEditor
                  days={modal.days || []}
                  onChange={(nextDays) => setModal({ ...modal, days: nextDays })}
                  legend="Itinerary days"
                />
                <button className="button">Save itinerary</button>
              </form>
            ) : (
              <ItineraryPreview days={modal.days || []} />
            )}
          </div>
        </Modal>
      )}
    </AdminPage>
  );
}

export function AdminDestinations() {
  const blank = { city: '', province: '', country: 'Indonesia', category: 'domestic', image_url: '', price: '' };
  const [items, setItems] = useState([]); const [modal, setModal] = useState(null); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [sort, setSort] = useState('name_asc');
  const load = () => unwrap(api.get('/admin/destinations',{params:{limit:100,sort}}), 'destinations').then(setItems);
  useEffect(() => { load(); }, [sort]);
  const openEdit = (destination) => setModal({ ...destination, destinationId: destination._id, category: destination.category || 'domestic' });
  const save = async e => { e.preventDefault(); setMessage(''); setError(''); try { const destinationId = modal.destinationId || modal._id; const body = { city: modal.city, province: modal.province, country: modal.country, category: modal.category || 'domestic', image_url: modal.image_url || modal.imageUrl || '', price: Number(modal.price) }; console.log('Updating destination:', destinationId, body); destinationId ? await api.put(`/admin/destinations/${destinationId}`, body) : await api.post('/admin/destinations', body); setModal(null); await load(); setMessage('Destination saved successfully.'); } catch(e){ console.log('Update destination error response:', e.response?.data || e.message); setError(e.response?.data?.message || 'Failed to save destination.'); } };
  const remove = id => api.delete(`/admin/destinations/${id}`).then(load).catch(e => setError(e.response?.data?.message || 'Failed to delete destination.'));
  return <AdminPage eyebrow="PLACES" title="Manage destinations" text="Maintain the places travelers can discover and book." action={<div className="admin-actions"><SortSelect value={sort} onChange={setSort} /><button className="button compact" onClick={() => setModal(blank)}>+ New destination</button></div>}><Alert success={message} error={error} /><DataTable headers={['Destination','Location','Category','Price','Actions']}>{items.map(x => <tr key={x._id}><td><strong>{x.city}</strong><small>{x.country}</small></td><td>{x.province}<small>{x.city}</small></td><td><div className="catalog-meta"><span>{x.category || 'domestic'}</span></div></td><td>{money(x.price)}</td><td><button onClick={() => openEdit(x)}>Edit</button><button className="danger-link" onClick={() => remove(x._id)}>Delete</button></td></tr>)}</DataTable>
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
  return <AdminPage eyebrow="FINANCE" title="Manage payments" text="Verify submitted payments and confirm bookings." action={<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All status</option>{['pending','checking','verified'].map(x=><option key={x}>{x}</option>)}</select>}><Alert success={message} error={error} /><DataTable headers={['Customer','Trip / Booking','Method','Amount','Proof','Status','Update']}>{items.map(x=><tr key={x._id}><td><strong>{x.user_id?.name}</strong><small>{x.user_id?.email}</small></td><td><strong>{x.trip_id?.title || '-'}</strong><small><Status value={x.booking_status || x.booking_id?.status}/></small></td><td><strong>{x.method}</strong><small>{x.bank_name || (x.card_last4 && `Card **** ${x.card_last4}`) || '-'}</small></td><td>{money(x.amount)}</td><td>{x.proof_url?<a href={proofHref(x.proof_url)} target="_blank" rel="noreferrer">View proof</a>:'-'}</td><td><Status value={x.status}/></td><td><select value={x.status} onChange={e=>change(x,e.target.value)}>{['pending','checking','verified'].map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</DataTable></AdminPage>;
}

export function AdminReviews() {
  const [items,setItems]=useState([]);
  const load=()=>unwrap(api.get('/admin/reviews?limit=100'),'reviews').then(setItems);
  useEffect(()=>{load();},[]);
  return <AdminPage eyebrow="COMMUNITY" title="Review monitoring" text="Monitor traveler feedback and experiences across every trip."><DataTable headers={['Traveler','Trip','Rating','Comment']}>{items.map(x=><tr key={x._id}><td><strong>{x.user_id?.name || x.user_name || x.user_id}</strong></td><td>{x.trip_id?.title || x.trip_title || x.trip_id}</td><td><span className="stars">{'★'.repeat(x.rating)}</span></td><td>{x.comment||'-'}</td></tr>)}</DataTable></AdminPage>;
}
