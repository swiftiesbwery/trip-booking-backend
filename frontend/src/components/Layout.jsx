import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const filterOptions = [
  ['all', 'All'],
  ['domestic', 'Domestic'],
  ['international', 'International'],
];

const sortOptions = [
  ['price_asc', 'Price Low-High'],
  ['price_desc', 'Price High-Low'],
];

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [transparent, setTransparent] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const isExplore = location.pathname === '/explore';

  useEffect(() => {
    const updateNavbar = () => {
      setTransparent(window.scrollY > 50);
    };
    updateNavbar();
    window.addEventListener('scroll', updateNavbar, { passive: true });
    window.addEventListener('resize', updateNavbar);
    return () => {
      window.removeEventListener('scroll', updateNavbar);
      window.removeEventListener('resize', updateNavbar);
    };
  }, []);

  useEffect(() => {
    if (!isExplore) {
      setOpenMenu('');
      setFilter('all');
      setSort('');
    }
  }, [isExplore]);

  const updateExploreFilter = (nextFilter) => {
    setFilter(nextFilter);
    setOpenMenu('');
    window.dispatchEvent(new CustomEvent('wanderly-explore-controls', { detail: { category: nextFilter } }));
  };

  const updateExploreSort = (nextSort) => {
    setSort(nextSort);
    setOpenMenu('');
    window.dispatchEvent(new CustomEvent('wanderly-explore-controls', { detail: { sort: nextSort } }));
  };

  return (
    <header className={`navbar ${transparent ? 'navbar-transparent' : ''}`}>
      <NavLink to="/" className="brand">Wanderly<span>.</span></NavLink>
      <nav className="nav-links">
        <NavLink end to="/">Home</NavLink>
        <NavLink to="/explore">Explore</NavLink>
        {user?.role === 'user' && <NavLink to="/wishlist">Wishlist</NavLink>}
        {user?.role === 'user' && <NavLink to="/bookings">My bookings</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      {isExplore && (
        <div className="nav-explore-filters">
          <NavbarDropdown
            label="Filter"
            name="filter"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            options={filterOptions}
            value={filter}
            onSelect={updateExploreFilter}
          />
          <NavbarDropdown
            label="Sort"
            name="sort"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            options={sortOptions}
            value={sort}
            onSelect={updateExploreSort}
          />
        </div>
      )}
      <div className="nav-actions">
        {user ? (
          <>
            <span className="user-pill">{user.name}</span>
            <button className="button ghost small" onClick={logout}>Logout</button>
          </>
        ) : (
          <NavLink className="button small" to="/login">Sign in</NavLink>
        )}
      </div>
    </header>
  );
}

function NavbarDropdown({ label, name, openMenu, setOpenMenu, options, value, onSelect }) {
  const open = openMenu === name;
  return (
    <div className="nav-dropdown">
      <button type="button" className="nav-dropdown-button" onClick={() => setOpenMenu(open ? '' : name)}>
        {label} <span>▼</span>
      </button>
      {open && (
        <div className="nav-dropdown-menu">
          {options.map(([key, optionLabel]) => (
            <button
              key={key}
              type="button"
              className={value === key ? 'active' : ''}
              onClick={() => onSelect(key)}
            >
              {optionLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserLayout() {
  return <><Navbar /><main><Outlet /></main><Footer /></>;
}

function Footer() {
  return (
    <footer>
      <strong>Wanderly.</strong>
      <span>Thoughtful trips, beautiful memories.</span>
    </footer>
  );
}

const adminLinks = [
  ['', 'Overview'],
  ['trips', 'Trips'],
  ['destinations', 'Destinations'],
  ['itineraries', 'Itineraries'],
  ['bookings', 'Bookings'],
  ['payments', 'Payments'],
  ['reviews', 'Reviews'],
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">Wanderly<span>.</span></NavLink>
        <p className="eyebrow">ADMIN SPACE</p>
        <nav>
          {adminLinks.map(([path, label]) => (
            <NavLink key={label} end={!path} to={`/admin/${path}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user?.name?.[0]}</div>
          <div><strong>{user?.name}</strong><small>Administrator</small></div>
          <button onClick={logout}>Exit</button>
        </div>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
}
