import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, ProtectedRoute } from './components/Routes';
import { AdminLayout, UserLayout } from './components/Layout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DestinationDetailPage, ExplorePage, HomePage, TripDetailPage } from './pages/ExplorePages';
import { BookingPage, MyBookingsPage, WishlistPage } from './pages/UserPages';
import { AdminBookings, AdminDashboard, AdminDestinations, AdminPayments, AdminReviews, AdminTrips } from './pages/AdminPages';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
              <Route path="wishlist" element={<WishlistPage />} />
            </Route>
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="trips" element={<AdminTrips />} />
              <Route path="destinations" element={<AdminDestinations />} />
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
