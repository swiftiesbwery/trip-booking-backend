import api from './api';

export const getWishlist = async () => {
  const { data } = await api.get('/wishlists');
  return data.data.wishlist || [];
};

export const getWishlistedTripMap = (items) => {
  const map = new Map();
  for (const item of items) {
    const tripId = item.trip_id?._id || item.trip_id;
    if (tripId) map.set(String(tripId), item);
  }
  return map;
};

export const toggleTripWishlist = async (tripId, currentItem) => {
  if (currentItem?._id) {
    await api.delete(`/wishlists/${currentItem._id}`);
    return { active: false, item: null };
  }

  const { data } = await api.post('/wishlists', { trip_id: tripId });
  return { active: true, item: data.data.wishlist };
};
