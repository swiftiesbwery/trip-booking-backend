import React from 'react';
import ReactDOM from 'react-dom/client';
import { useLayoutEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, ProtectedRoute } from './components/Routes';
import { AdminLayout, UserLayout } from './components/Layout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DestinationDetailPage, ExplorePage, HomePage, TripDetailPage } from './pages/ExplorePages';
import { BookingPage, ItineraryPlannerPage, MyBookingsPage, WishlistPage } from './pages/UserPages';
import { AdminBookings, AdminDashboard, AdminDestinations, AdminItineraries, AdminPayments, AdminReviews, AdminTrips } from './pages/AdminPages';
import './styles.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [pathname]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<UserLayout />}>
            <Route index element={<HomePage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="trips/:id" element={<TripDetailPage />} />
            <Route path="destinations/:id" element={<DestinationDetailPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="booking/:type/:id" element={<BookingPage />} />
              <Route path="bookings" element={<MyBookingsPage />} />
              <Route path="my-bookings" element={<MyBookingsPage />} />
              <Route path="my-bookings/:bookingId/itinerary" element={<ItineraryPlannerPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
            </Route>
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="trips" element={<AdminTrips />} />
              <Route path="destinations" element={<AdminDestinations />} />
              <Route path="itineraries" element={<AdminItineraries />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="reviews" element={<AdminReviews />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
