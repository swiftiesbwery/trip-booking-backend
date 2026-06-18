import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { getWishlist, getWishlistedTripMap, toggleTripWishlist } from '../services/wishlist';
import { Alert, Empty, PageHeader, TripCard, date, money } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import hero from '../assets/travel-hero.png';

const fallbackImage = '/assets/destinations/fallback-snow.png';

const showcaseDestinations = [
  {
    key: 'korea',
    country: 'Korea',
    text: 'modern city lights, culture, shopping, food, and night experiences',
    image: "/assets/destinations/korea-winter.jpg",
    places: [
      ['Busan', '/assets/destinations/busan.jpg'],
      ['Jeju Island', '/assets/destinations/jeju-island.jpg'],
      ['Nami Island', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=80'],
      ['Gyeongbokgung Palace in winter', 'https://images.unsplash.com/photo-1617469165786-8007eda3caa7?auto=format&fit=crop&w=700&q=80'],
      ['Seoul', '/assets/destinations/seoul.jpg'],
    ],
  },
  {
    key: 'japan',
    country: 'Japan',
    text: 'temples, sakura, calm streets, culture, and seasonal beauty',
    image: '/assets/destinations/mount-fuji.jpg',
    places: [
      ['Tokyo', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=700&q=80'],
      ['Shibuya', 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=700&q=80'],
      ['Kyoto', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=700&q=80'],
      ['Osaka', 'https://images.unsplash.com/photo-1590559899731-a382839e5549?auto=format&fit=crop&w=700&q=80'],
      ['Mount Fuji', 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?auto=format&fit=crop&w=700&q=80'],
    ],
  },

  {
    key: 'switzerland',
    country: 'Switzerland',
    text: 'mountains, lakes, peaceful villages, and luxury nature escape',
    image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1800&q=85',
    places: [
      ['Zurich', 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&w=700&q=80'],
      ['Interlaken', 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=700&q=80'],
      ['Zermatt', '/assets/destinations/zermatt.jpg'],
      ['Lucerne', 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=700&q=80'],
      ['Swiss Alps', 'https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=700&q=80'],
    ],
  },
  {
    key: 'europe',
    country: 'Europe',
    text: 'classic cities, architecture, museums, romance, and scenic streets',
    image: 'https://images.unsplash.com/photo-1491557345352-5929e343eb89?auto=format&fit=crop&w=1800&q=85',
    places: [
      ['Paris', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=700&q=80'],
      ['Rome', 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=700&q=80'],
      ['Amsterdam', 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=700&q=80'],
      ['Prague', 'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=700&q=80'],
      ['Barcelona', 'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?auto=format&fit=crop&w=700&q=80'],
    ],
  },
];

const featureCards = [
  ['Explore trips', 'Browse curated trips with schedules, seats, prices, and connected destinations.'],
  ['Save wishlist', 'Keep favorite trips in one place before deciding where to go next.'],
  ['Book simply', 'Reserve your trip in a clear booking flow built for everyday travelers.'],
  ['Submit payment', 'Upload or submit payment details and track verification from My bookings.'],
];

function sortExploreItems(items, sortBy, getLabel) {
  const list = [...items];
  if (sortBy === 'price_asc') return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  if (sortBy === 'price_desc') return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  return list.sort((a, b) => (getLabel(a) || '').localeCompare(getLabel(b) || ''));
}

function useRevealOnScroll() {
  useEffect(() => {
    const items = document.querySelectorAll('.reveal, .reveal-on-scroll');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.classList.add('show');
        } else {
          entry.target.classList.remove('visible');
          entry.target.classList.remove('show');
        }
      });
    }, { threshold: 0.18 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
}

export function HomePage() {
  useRevealOnScroll();
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  return <>
    <section className="home-hero">
      <div className="home-hero-media" aria-hidden="true">
        {!heroVideoFailed ? (
          <video className="hero-video" autoPlay muted loop playsInline poster={fallbackImage} onError={() => setHeroVideoFailed(true)}>
            <source src="/assets/videos/snow-home.mp4" type="video/mp4" />
          </video>
        ) : (
          <img className="hero-video hero-video-fallback" src={fallbackImage} alt="" />
        )}
      </div>
      <div className="home-hero-overlay" aria-hidden="true" />
      <div className="home-hero-copy">
        <p className="eyebrow reveal-on-scroll show">PLAN YOUR NEXT TRIP</p>
        <h1 className="reveal-on-scroll show" style={{ transitionDelay: '.08s' }}>Plan softer, smarter journeys with Wanderly.</h1>
        <p className="reveal-on-scroll show" style={{ transitionDelay: '.16s' }}>Wanderly helps you discover curated trips, compare destinations, save favorites, book seats, and submit payment in one calm travel flow.</p>
        <div className="home-cta reveal-on-scroll show" style={{ transitionDelay: '.24s' }}>
          <Link className="showcase-text-link" to="/explore">Explore Trips →</Link>
          <Link className="showcase-text-link" to="/explore#destinations">Discover Destinations →</Link>
        </div>
      </div>
    </section>

    <section className="home-section why-editorial">
      <div className="home-intro why-editorial-copy">
        <p className="eyebrow reveal-on-scroll">WHY WANDERLY</p>
        <h2 className="reveal-on-scroll" style={{ transitionDelay: '.08s' }}>Why Travelers Love Wanderly.</h2>
        <p className="reveal-on-scroll" style={{ transitionDelay: '.16s' }}>Instead of jumping between notes, chats, and scattered travel posts, Wanderly keeps the main decisions together: where to go, which trip fits, what to save, and how to complete the booking.</p>
      </div>
      <div className="why-feature-list">
        {featureCards.map(([title, text], index) => <article className="why-feature-item why-card reveal-on-scroll" style={{ transitionDelay: `${index * 0.12}s` }} key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
      </div>
    </section>

    <section className="destination-story" aria-label="Destination showcase">
      {showcaseDestinations.map((item) => <CountrySection item={item} key={item.key} />)}
    </section>
  </>;
}

function CountrySection({ item }) {
  return <section className={`country-section ${item.key}`} style={{ backgroundImage: `url(${item.image})` }}>
    <div className="country-copy">
      <p className="eyebrow light reveal-on-scroll">DESTINATION SHOWCASE</p>
      <h2 className="reveal-on-scroll" style={{ transitionDelay: '.08s' }}>{item.country}</h2>
      <p className="reveal-on-scroll" style={{ transitionDelay: '.16s' }}>{item.text}</p>
      <Link className="showcase-text-link reveal-on-scroll" style={{ transitionDelay: '.24s' }} to="/explore#destinations">Discover more →</Link>
    </div>
    <div className="places-panel">
      <p className="eyebrow light reveal-on-scroll">PLACES TO VISIT</p>
      <div className="places-carousel">
        {item.places.map(([place, image], index) => <PlaceCard key={place} name={place} image={image} delay={index * 90} />)}
      </div>
    </div>
  </section>;
}

function PlaceCard({ name, image, delay }) {
  return <article className="place-card reveal-on-scroll" style={{ transitionDelay: `${delay}ms` }}>
    <img
      src={image}
      alt={name}
      loading="lazy"
      onError={(e) => {
        if (e.currentTarget.src !== fallbackImage) e.currentTarget.src = fallbackImage;
      }}
    />
    <strong className="place-card-title">{name}</strong>
  </article>;
}

export function ExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState('');
  const [tripCategory, setTripCategory] = useState('all');
  const [destinationCategory, setDestinationCategory] = useState('all');
  const [tripSort, setTripSort] = useState('');
  const [destinationSort, setDestinationSort] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wishlistByTrip, setWishlistByTrip] = useState(new Map());
  const [wishlistBusy, setWishlistBusy] = useState('');

  const load = async (term = '') => {
    setLoading(true);
    setError('');
    try {
      const tripParams = { search: term, limit: 12, category: tripCategory };
      const destinationParams = { search: term, limit: 12, category: destinationCategory };
      if (tripSort) tripParams.sort = tripSort;
      if (destinationSort) destinationParams.sort = destinationSort;
      const requests = [
        api.get('/trips', { params: tripParams }),
        api.get('/destinations', { params: destinationParams }),
      ];
      if (user?.role === 'user') requests.push(getWishlist());
      const [tripRes, destinationRes, wishlistItems] = await Promise.all(requests);
      setTrips(sortExploreItems(tripRes.data.data.trips, tripSort, (item) => item.title));
      setDestinations(sortExploreItems(destinationRes.data.data.destinations, destinationSort, (item) => item.title || item.city));
      if (wishlistItems) setWishlistByTrip(getWishlistedTripMap(wishlistItems));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load catalog.');
    } finally { setLoading(false); }
  };
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => { load(search); }, [user?._id, tripSort, destinationSort, tripCategory, destinationCategory]);
  useEffect(() => {
    const updateControls = (event) => {
      const { category, sort } = event.detail || {};
      if (category) {
        setTripCategory(category);
        setDestinationCategory(category);
      }
      if (sort) {
        setTripSort(sort);
        setDestinationSort(sort);
      }
    };
    window.addEventListener('wanderly-explore-controls', updateControls);
    return () => window.removeEventListener('wanderly-explore-controls', updateControls);
  }, []);
  useEffect(() => {
    if (loading) return undefined;
    const panels = document.querySelectorAll('.gallery-item');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, [loading, trips, destinations]);
  useEffect(() => {
    if (loading) return undefined;
    const panels = document.querySelectorAll('.explore-story-panel');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.22 });
    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, [loading, trips.length, destinations.length]);

  const wish = async (trip_id) => {
    if (!user) return navigate('/login');
    if (user.role !== 'user') return setNotice('Only user accounts can use wishlist.');
    setWishlistBusy(trip_id);
    try {
      const result = await toggleTripWishlist(trip_id, wishlistByTrip.get(String(trip_id)));
      setWishlistByTrip((current) => {
        const next = new Map(current);
        if (result.active) next.set(String(trip_id), result.item);
        else next.delete(String(trip_id));
        return next;
      });
      setNotice(result.active ? 'Trip added to your wishlist.' : 'Trip removed from your wishlist.');
    } catch (err) {
      setNotice(err.response?.data?.message || 'Wishlist update failed.');
    } finally {
      setWishlistBusy('');
    }
  };

  return <>
    <section className="section explore-section"><Alert success={notice} error={error} />
      {loading ? <div className="page-loader">Finding beautiful trips...</div> : trips.length ? <div className="explore-story">
        <TripsHeroPanel image={trips[0]?.image_url || hero} search={search} setSearch={setSearch} onSearch={(e) => { e.preventDefault(); load(search); }} />
        <TripsCardsPanel trips={trips} wish={wish} wishlistByTrip={wishlistByTrip} wishlistBusy={wishlistBusy} />
      </div> : <Empty title="No trips found" text="Try a different destination or keyword." />}
    </section>

    <section id="destinations" className="section destination-section">
      {loading ? <div className="page-loader">Finding beautiful destinations...</div> : destinations.length ? <div className="explore-story">
        <DestinationsHeroPanel image={destinations[0]?.image_url || hero} />
        <DestinationsCardsPanel destinations={destinations} />
      </div> : <Empty title="No destinations found" text="Try a different destination or keyword." />}
    </section>
  </>;
}

function TripsHeroPanel({ image, search, setSearch, onSearch }) {
  return <section className="explore-story-panel explore-story-hero" style={{ backgroundImage: `url(${image})` }}>
    <div className="explore-story-copy">
      <p className="gallery-eyebrow">TRIPS</p>
      <h1>Discover Amazing Trips</h1>
      <p>Handpicked experiences for your next unforgettable journey.</p>
      <form className="explore-search" onSubmit={onSearch}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search city, country, or trip name" />
        <button className="button">Explore</button>
      </form>
    </div>
  </section>;
}

function TripsCardsPanel({ trips, wish, wishlistByTrip, wishlistBusy }) {
  return <section className="explore-story-panel explore-story-cards">
    <div className="image-gallery-row explore-story-row">{trips.map((trip, index) => <TripGalleryItem key={trip._id} trip={trip} index={index} onWishlist={wish} isWishlisted={wishlistByTrip.has(String(trip._id))} wishlistBusy={wishlistBusy === trip._id} />)}</div>
  </section>;
}

function DestinationsHeroPanel({ image }) {
  return <section className="explore-story-panel explore-story-hero" style={{ backgroundImage: `url(${image})` }}>
    <div className="explore-story-copy">
      <p className="gallery-eyebrow">DESTINATIONS</p>
      <h1>Explore Beautiful Destinations</h1>
      <p>Discover places worth visiting around the world.</p>
    </div>
  </section>;
}

function DestinationsCardsPanel({ destinations }) {
  return <section className="explore-story-panel explore-story-cards">
    <div className="image-gallery-row explore-story-row">{destinations.map((item, index) => <DestinationGalleryItem key={item._id} item={item} index={index} />)}</div>
  </section>;
}

function GalleryHeadingPanel({ eyebrow, title, text, image }) {
  return <article className="gallery-item gallery-heading-panel" style={{ backgroundImage: `url(${image})` }}>
    <div className="gallery-content">
      <p className="gallery-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  </article>;
}

function TripGalleryItem({ trip, index, onWishlist, isWishlisted, wishlistBusy }) {
  const image = trip.image_url || trip.destinations?.[0]?.destination_id?.image_url || hero;
  const place = trip.destinations?.[0]?.destination_id;
  const location = trip.city || place?.city || place?.province || trip.country || place?.country || 'Indonesia';
  const rating = trip.rating?.avg || trip.rating_avg || trip.avg_rating || trip.average_rating || 'New';
  return <article className={`gallery-item ${index % 2 ? 'gallery-item-slim' : 'gallery-item-wide'}`} style={{ backgroundImage: `url(${image})`, transitionDelay: `${index * 100}ms` }}>
    <div className="gallery-content">
      <p className="gallery-location">{location}</p>
      <h2>{trip.title}</h2>
      <div className="gallery-meta">{rating !== 'New' && <span>★ {rating}</span>}<strong>{money(trip.price)}</strong></div>
      <Link className="button gallery-button" to={`/trips/${trip._id}`}>View Experience →</Link>
    </div>
    {onWishlist && <button type="button" className={`gallery-heart ${isWishlisted ? 'active' : ''}`} disabled={wishlistBusy} onClick={() => onWishlist(trip._id)} aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}>{isWishlisted ? '♥' : '♡'}</button>}
  </article>;
}

function DestinationGalleryItem({ item, index }) {
  const image = item.image_url || hero;
  const location = item.province || item.location || item.country || 'Indonesia';
  return <article className={`gallery-item ${index % 2 ? 'gallery-item-slim' : 'gallery-item-wide'}`} style={{ backgroundImage: `url(${image})`, transitionDelay: `${(index % 4) * 90}ms` }}>
    <div className="gallery-content">
      <p className="gallery-location">{location}</p>
      <h2>{item.city}</h2>
      <div className="gallery-meta"><strong>{money(item.price)}</strong></div>
      <Link className="button gallery-button" to={`/destinations/${item._id}`}>View Experience →</Link>
    </div>
  </article>;
}

export function DestinationDetailPage() {
  const { id } = useParams();
  const [destination, setDestination] = useState(null);
  const [trips, setTrips] = useState([]);
  useEffect(() => {
    api.get(`/destinations/${id}`).then(({ data }) => {
      setDestination(data.data.destination);
      setTrips(data.data.trips);
    });
  }, [id]);
  if (!destination) return <div className="page-loader">Opening destination...</div>;
  return <>
    <section className="detail-hero" style={{ backgroundImage: `url(${destination.image_url || hero})` }}><div><Link to="/explore">← Back to explore</Link><p className="eyebrow light">{destination.province}</p><h1>{destination.city}</h1><p>{destination.country} · A destination ready for your next story.</p></div></section>
    <section className="section"><PageHeader eyebrow="VISIT YOUR WAY" title={`Discover ${destination.city}`} text={`Choose a scheduled trip that visits ${destination.city}. Trip dates are set by the organizer.`} />
      {trips.length ? <div className="trip-grid">{trips.map(trip => <TripCard key={trip._id} trip={trip} />)}</div> : <Empty title="No connected trips yet" text="Check back when a scheduled trip becomes available." />}
    </section>
  </>;
}

export function TripDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [rating, setRating] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [message, setMessage] = useState('');
  const [wishlistItem, setWishlistItem] = useState(null);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const load = async () => {
    const requests = [api.get(`/trips/${id}`), api.get(`/trips/${id}/reviews`)];
    if (user?.role === 'user') requests.push(getWishlist());
    const [detail, reviewRes, wishlistItems] = await Promise.all(requests);
    setTrip(detail.data.data.trip); setRating(detail.data.data.rating); setReviews(reviewRes.data.data.reviews);
    if (wishlistItems) setWishlistItem(getWishlistedTripMap(wishlistItems).get(String(detail.data.data.trip._id)) || null);
  };
  useEffect(() => { load().catch(() => navigate('/explore')); }, [id, user?._id]);

  const saveTrip = async () => {
    if (!user) return navigate('/login');
    if (user.role !== 'user') return setMessage('Only user accounts can use wishlist.');
    setWishlistBusy(true);
    try {
      const result = await toggleTripWishlist(trip._id, wishlistItem);
      setWishlistItem(result.item);
      setMessage(result.active ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Wishlist update failed.');
    } finally {
      setWishlistBusy(false);
    }
  };

  if (!trip) return <div className="page-loader">Opening trip...</div>;
  const image = trip.image_url || trip.destinations?.[0]?.destination_id?.image_url || hero;

  return <div className="detail-page">
    <section className="detail-hero" style={{ backgroundImage: `url(${image})` }}><div><Link to="/explore">← Back to explore</Link><p className="eyebrow light">CURATED ESCAPE</p><h1>{trip.title}</h1><p>{trip.description || 'A beautiful journey designed for memorable days.'}</p></div></section>
    <section className="detail-layout"><div className="detail-main">
      <div className="info-strip"><div><span>Start</span><strong>{date(trip.start_date || trip.departure_date)}</strong></div><div><span>End</span><strong>{date(trip.end_date)}</strong></div><div><span>Rating</span><strong>{rating?.avg || 'New'} / 5</strong></div><div><span>Group</span><strong>{trip.quota} seats</strong></div></div>
      <div className="content-card"><p className="eyebrow">THE JOURNEY</p><h2>Places on this trip</h2><div className="place-list">{trip.destinations?.map((item, i) => <div key={item.destination_id?._id}><span>{String(i + 1).padStart(2, '0')}</span><img src={item.destination_id?.image_url || hero} /><div><h3>{item.destination_id?.city}</h3><p>{item.destination_id?.province}, {item.destination_id?.country}</p></div></div>)}</div></div>
      <div className="content-card"><p className="eyebrow">TRAVELER STORIES</p><h2>Reviews</h2>{reviews.length ? <div className="review-list">{reviews.map((item) => { const reviewer = item.user_id?.name || item.user_name || 'Traveler'; const photos = item.photos || []; return <article key={item._id}><div className="avatar">{reviewer[0]}</div><div><strong>{reviewer}</strong><span>{'★'.repeat(item.rating)}</span><p>{item.comment}</p>{Boolean(photos.length) && <div className="review-photo-grid">{photos.map((photo) => <button type="button" key={photo} onClick={() => setPreviewPhoto(photo)}><img src={photo} alt={`${reviewer} review`} /></button>)}</div>}</div></article>; })}</div> : <Empty title="No reviews yet" text="Be the first to share your story." />}
        {user?.role === 'user' && <p className="review-guidance">Write a review from an eligible confirmed or completed trip in <Link to="/bookings">My bookings</Link>.</p>}
      </div>
    </div>
    <aside className="booking-summary"><p>Starting from</p><h2>{money(trip.price)}</h2><span>per person</span><Link className="button wide" to={`/booking/trip/${trip._id}`}>Book this trip</Link><button className={`button ghost wide wishlist-detail-button ${wishlistItem ? 'active' : ''}`} disabled={wishlistBusy} onClick={saveTrip}>{wishlistItem ? '♥ Saved to wishlist' : '♡ Save to wishlist'}</button>{message && <small>{message}</small>}<small>Secure booking · Payment verification</small></aside></section>
    {previewPhoto && <div className="modal-backdrop review-lightbox" onMouseDown={() => setPreviewPhoto(null)}><div className="review-lightbox-content" onMouseDown={(e) => e.stopPropagation()}><button type="button" onClick={() => setPreviewPhoto(null)} aria-label="Close photo preview">×</button><img src={previewPhoto} alt="Review preview" /></div></div>}
  </div>;
}
