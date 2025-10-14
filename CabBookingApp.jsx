import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Calendar, Car, Bike, Send, User, LogIn, Sun, Moon, Menu, X, Home, BookOpen, Settings, DollarSign, Motorcycle, Truck, Shield, ChevronsRight, CheckCircle, XCircle, BarChart3, Users, Receipt, ListChecks } from 'lucide-react';

// --- Global Setup ---
// These global variables are provided by the canvas environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-cab-app';
const API_KEY = ""; // Placeholder for Gemini API Key

// Helper function for exponential backoff (necessary for production API calls)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Simple mock data for fare calculation (in cents per kilometer)
const VEHICLE_RATES = {
  Cab: { base: 500, rate: 150 },
  Auto: { base: 200, rate: 100 },
  Bike: { base: 100, rate: 50 },
  Taxi: { base: 600, rate: 180 },
};

// Mock Distance Calculation
const mockDistance = (pickup, dropoff) => {
  // A simple hash-based mock distance for demo purposes
  const hash = (s) => s.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
  const dist = Math.abs(hash(pickup) - hash(dropoff)) % 20 + 5; // Distance between 5 and 25 km
  return dist.toFixed(1);
};

// Firestore Paths
const getBookingsCollectionRef = (db) => {
  // Storing bookings publicly for easy demo and admin/driver access
  return collection(db, `artifacts/${appId}/public/data/bookings`);
};

// --- Custom Hooks and Utilities ---

const useFirebase = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Initialize Firebase
    if (!firebaseConfig || !Object.keys(firebaseConfig).length) {
      console.error("Firebase configuration is missing.");
      setIsLoading(false);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authService = getAuth(app);
      setDb(firestore);
      setAuth(authService);
      console.log('Firebase initialized.');

      // 2. Auth State Change Listener & Custom Token Sign-in
      const unsubscribe = onAuthStateChanged(authService, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          console.log('User signed in:', currentUser.uid);
        } else {
          try {
            if (initialAuthToken) {
              // Sign in with the provided custom token
              await signInWithCustomToken(authService, initialAuthToken);
              console.log('Signed in with custom token.');
            } else {
              // Fallback to anonymous sign-in if no token is present
              const result = await signInAnonymously(authService);
              setUser(result.user);
              console.log('Signed in anonymously.');
            }
          } catch (error) {
            console.error("Authentication Error:", error);
          }
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setIsLoading(false);
    }
  }, []);

  return { db, auth, user, isLoading };
};

const useBookings = (db, userId) => {
  const [bookings, setBookings] = useState([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) {
      setBookings([]);
      setIsBookingsLoading(false);
      return;
    }

    const q = getBookingsCollectionRef(db);

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to JS Date object for easier sorting/display
        bookingDate: doc.data().bookingDate?.toDate(),
      }));

      // Sort by creation time (newest first)
      allBookings.sort((a, b) => b.createdAt - a.createdAt);

      setBookings(allBookings);
      setIsBookingsLoading(false);
      console.log('Bookings updated:', allBookings.length);
    }, (error) => {
      console.error("Error fetching bookings:", error);
      setIsBookingsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  return { bookings, isBookingsLoading };
};

// --- Global Components ---

const Header = ({ user, currentPage, setCurrentPage, mode, toggleMode, auth }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Home', page: 'home', icon: Home, show: true },
    { name: 'My Bookings', page: 'dashboard', icon: BookOpen, show: user && !user.isAnonymous },
    { name: 'Admin Panel', page: 'admin', icon: Settings, show: user && user.email === 'admin@cabapp.com' }, // Simple mock admin check
    { name: 'About & Contact', page: 'contact', icon: User, show: true },
  ];

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentPage('home');
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full shadow-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 cursor-pointer" onClick={() => setCurrentPage('home')}>
          RideSwift
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-6 items-center">
          {navItems.filter(item => item.show).map(item => (
            <a
              key={item.page}
              href="#"
              onClick={() => { setCurrentPage(item.page); setIsOpen(false); }}
              className={`flex items-center text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 ${currentPage === item.page ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}
            >
              <item.icon className="w-5 h-5 mr-1" />
              {item.name}
            </a>
          ))}
          <button
            onClick={toggleMode}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {!user || user.isAnonymous ? (
            <button
              onClick={() => setCurrentPage('login')}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-md flex items-center"
            >
              <LogIn className="w-4 h-4 mr-1" />
              Login/Signup
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-full hover:bg-red-700 transition duration-300 shadow-md flex items-center"
            >
              <User className="w-4 h-4 mr-1" />
              Sign Out
            </button>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center space-x-2">
          <button
            onClick={toggleMode}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-lg text-gray-800 dark:text-gray-200">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 py-2">
          {navItems.filter(item => item.show).map(item => (
            <a
              key={item.page}
              href="#"
              onClick={() => { setCurrentPage(item.page); setIsOpen(false); }}
              className={`block px-4 py-2 text-base font-medium transition-colors ${currentPage === item.page ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <item.icon className="w-5 h-5 inline mr-2" />
              {item.name}
            </a>
          ))}
          <div className="px-4 py-2 mt-2 border-t border-gray-100 dark:border-gray-700">
            {!user || user.isAnonymous ? (
              <button
                onClick={() => { setCurrentPage('login'); setIsOpen(false); }}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-base font-semibold rounded-lg hover:bg-indigo-700 transition duration-300 flex justify-center items-center"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Login/Signup
              </button>
            ) : (
              <button
                onClick={() => { handleSignOut(); setIsOpen(false); }}
                className="w-full px-4 py-2 bg-red-600 text-white text-base font-semibold rounded-lg hover:bg-red-700 transition duration-300 flex justify-center items-center"
              >
                <User className="w-5 h-5 mr-2" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

// --- Page Views ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin dark:border-indigo-800 dark:border-t-indigo-400"></div>
  </div>
);

const HomeView = ({ setCurrentPage, user, db }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [vehicleType, setVehicleType] = useState('Cab');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [fareEstimate, setFareEstimate] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState(null);

  const handleEstimate = useCallback(() => {
    if (!pickup || !dropoff) {
      setError('Please enter both pickup and drop-off locations.');
      setFareEstimate(null);
      return;
    }
    setError(null);
    setIsEstimating(true);

    const dist = mockDistance(pickup, dropoff);
    setDistance(dist);

    const { base, rate } = VEHICLE_RATES[vehicleType];
    const fare = (base + parseFloat(dist) * rate) / 100; // Convert cents to dollars

    setTimeout(() => {
      setFareEstimate(fare.toFixed(2));
      setIsEstimating(false);
    }, 500);
  }, [pickup, dropoff, vehicleType]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user || user.isAnonymous) {
      alert("Please log in or sign up to complete a booking.");
      setCurrentPage('login');
      return;
    }

    if (!fareEstimate) {
      handleEstimate();
    }

    if (!fareEstimate) return; // Ensure fare is calculated before booking

    try {
      const newBooking = {
        userId: user.uid,
        userEmail: user.email || 'Anonymous User',
        pickup,
        dropoff,
        vehicleType,
        distance: `${distance} km`,
        fare: `$${fareEstimate}`,
        dateTime: new Date(`${date}T${time}`).toISOString(),
        status: 'Pending',
        createdAt: new Date(),
        paymentStatus: 'Pending',
      };

      await addDoc(getBookingsCollectionRef(db), newBooking);
      setError(null);
      alert("Booking successful! Check My Bookings for status updates.");
      setPickup('');
      setDropoff('');
      setFareEstimate(null);
      setDistance(null);
      setCurrentPage('dashboard');

    } catch (err) {
      console.error("Error adding document: ", err);
      setError('Failed to create booking. Please try again.');
    }
  };

  const VehicleIcon = ({ type }) => {
    switch (type) {
      case 'Cab': return <Car className="w-5 h-5 text-indigo-500" />;
      case 'Auto': return <Truck className="w-5 h-5 text-teal-500" />;
      case 'Bike': return <Motorcycle className="w-5 h-5 text-orange-500" />;
      case 'Taxi': return <Shield className="w-5 h-5 text-red-500" />;
      default: return <Car className="w-5 h-5 text-indigo-500" />;
    }
  };

  const vehicleOptions = ['Cab', 'Auto', 'Bike', 'Taxi'];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-4xl font-extrabold mb-2 text-gray-900 dark:text-white">
        Your Journey Starts Here
      </h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
        Book Cabs, Autos, Bikes, and Taxis instantly.
      </p>

      {/* Booking Form Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
        <form onSubmit={handleBooking} className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Pickup Location */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pickup Location (Mock)
            </label>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 dark:focus-within:ring-indigo-400">
              <MapPin className="w-5 h-5 text-indigo-500 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="e.g., Downtown Office"
                className="w-full p-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Drop-off Location */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Drop-off Location (Mock)
            </label>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 dark:focus-within:ring-indigo-400">
              <MapPin className="w-5 h-5 text-red-500 ml-3 flex-shrink-0" />
              <input
                type="text"
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                placeholder="e.g., Airport Terminal 3"
                className="w-full p-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm">
              <Calendar className="w-5 h-5 text-gray-400 ml-3" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm">
              <Clock className="w-5 h-5 text-gray-400 ml-3" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-3 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Vehicle
            </label>
            <div className="flex flex-wrap gap-4">
              {vehicleOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setVehicleType(type); setFareEstimate(null); }}
                  className={`flex flex-col items-center p-4 rounded-xl shadow-md transition-all duration-200 w-1/5 min-w-[80px] text-center
                    ${vehicleType === type
                      ? 'bg-indigo-600 text-white shadow-indigo-500/50 scale-105'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  <VehicleIcon type={type} />
                  <span className="mt-1 text-xs font-semibold">{type}</span>
                </button>
              ))}
              <div
                className="flex flex-col items-center p-4 rounded-xl shadow-md transition-all duration-200 w-1/5 min-w-[80px] text-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                onClick={() => setCurrentPage('vehicle-details')}
              >
                <ListChecks className="w-5 h-5" />
                <span className="mt-1 text-xs font-semibold">Details</span>
              </div>
            </div>
          </div>

          {/* Estimation & Booking Buttons */}
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 mt-4">
            <button
              type="button"
              onClick={handleEstimate}
              disabled={isEstimating || !pickup || !dropoff}
              className="flex-1 w-full sm:w-auto px-6 py-3 bg-gray-500 text-white text-lg font-semibold rounded-full hover:bg-gray-600 transition duration-300 shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isEstimating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Estimating...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 mr-2" />
                  Estimate Fare
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={!fareEstimate || isEstimating}
              className="flex-1 w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-lg shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-5 h-5 mr-2" />
              Book Now
            </button>
          </div>

          {/* Fare Estimate Display */}
          {fareEstimate && (
            <div className="md:col-span-2 mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl flex justify-between items-center border border-indigo-200 dark:border-indigo-800">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                **Distance:** {distance} km (Mock)
                <br />
                **Vehicle:** {vehicleType}
              </p>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                <span className="text-xl mr-1">$</span>{fareEstimate}
              </div>
            </div>
          )}

          {error && (
            <div className="md:col-span-2 text-red-500 text-sm mt-2 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg border border-red-300 dark:border-red-700">
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Placeholder Map & Info */}
      <div className="mt-10 p-6 bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-inner text-center text-gray-600 dark:text-gray-400">
        <MapPin className="w-8 h-8 mx-auto mb-3 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">
          Google Maps Integration Placeholder
        </h3>
        <p>
          In a full environment, this area would display a map with real-time location tracking and distance calculation.
        </p>
      </div>
    </div>
  );
};

const VehicleDetailsView = ({ setCurrentPage }) => {
  const vehicles = [
    { type: 'Cab', icon: Car, rate: '$1.50/km', base: '$5.00', desc: 'Standard comfortable car for 4 passengers. Ideal for city travel and short trips.' },
    { type: 'Auto', icon: Truck, rate: '$1.00/km', base: '$2.00', desc: 'Quick and economical 3-wheeler ride. Best for navigating congested areas.' },
    { type: 'Bike', icon: Motorcycle, rate: '$0.50/km', base: '$1.00', desc: 'The fastest way to beat traffic. Single passenger only.' },
    { type: 'Taxi', icon: Shield, rate: '$1.80/km', base: '$6.00', desc: 'Premium sedan service. Great for airport transfers and professional travel.' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900 dark:text-white">
        Our Vehicle Options & Pricing
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vehicles.map((v) => (
          <div key={v.type} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.01]">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full mr-4">
                <v.icon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{v.type}</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{v.desc}</p>
            <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-300">Base Fare</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{v.base}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-300">Per KM Rate</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{v.rate}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => setCurrentPage('home')}
          className="mt-6 px-8 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-lg flex items-center justify-center mx-auto"
        >
          <ChevronsRight className="w-5 h-5 mr-2" />
          Go to Booking
        </button>
      </div>
    </div>
  );
};

const UserDashboardView = ({ user, db, bookings, isBookingsLoading }) => {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' or 'payments'

  if (!user || user.isAnonymous) {
    return <NotAuthenticatedMessage />;
  }

  const userBookings = bookings.filter(b => b.userId === user.uid);

  const getStatusClasses = (status) => {
    switch (status) {
      case 'Accepted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Canceled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Pending':
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  const BookingList = () => (
    <div className="space-y-4">
      {isBookingsLoading ? <LoadingSpinner /> : userBookings.length === 0 ? (
        <p className="text-center py-10 text-gray-500 dark:text-gray-400">
          You have no bookings yet. Go to the Home page to book a ride!
        </p>
      ) : (
        userBookings.map((b) => (
          <div key={b.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 dark:border-indigo-400">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-indigo-500" />
                  {b.pickup} <ChevronsRight className="w-4 h-4 mx-2 text-gray-400" /> {b.dropoff}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(b.dateTime).toLocaleString()} | {b.vehicleType}
                </p>
              </div>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusClasses(b.status)}`}>
                {b.status}
              </span>
            </div>
            <div className="flex justify-between items-center mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{b.fare}</p>
              <span className={`px-2 py-1 text-xs font-medium rounded ${b.paymentStatus === 'Completed' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                Payment: {b.paymentStatus}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const PaymentHistory = () => (
    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
      <DollarSign className="w-10 h-10 mx-auto mb-3 text-indigo-500" />
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">Payment Gateway Placeholder</h3>
      <p>Payment history would be displayed here after successful Razorpay/Stripe transactions.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900 dark:text-white">
        Welcome, {user.email || 'User'}!
      </h1>

      {/* Tabs */}
      <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'bookings' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <BookOpen className="w-5 h-5 inline mr-2" /> My Bookings
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 text-lg font-semibold transition-colors border-b-2 ${activeTab === 'payments' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Receipt className="w-5 h-5 inline mr-2" /> Payment History
        </button>
      </div>

      {activeTab === 'bookings' ? <BookingList /> : <PaymentHistory />}
    </div>
  );
};

const AdminDashboardView = ({ user, db, bookings, isBookingsLoading }) => {
  if (user?.email !== 'admin@cabapp.com') {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8 text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-red-600 dark:text-red-400">Access Denied</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          This panel is for administrators only.
        </p>
      </div>
    );
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const docRef = doc(getBookingsCollectionRef(db), id);
      await updateDoc(docRef, { status: newStatus });
      console.log(`Booking ${id} status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating document:", error);
      alert(`Failed to update status: ${error.message}`);
    }
  };

  const getStatusClasses = (status) => {
    switch (status) {
      case 'Accepted': return 'bg-blue-500';
      case 'Completed': return 'bg-green-500';
      case 'Canceled': return 'bg-red-500';
      case 'Pending':
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-4xl font-extrabold mb-8 text-indigo-600 dark:text-indigo-400 flex items-center">
        <BarChart3 className="w-8 h-8 mr-3" /> Admin & Driver Panel
      </h1>

      {isBookingsLoading ? <LoadingSpinner /> : (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
            <ListChecks className="w-6 h-6 mr-2" /> All Current Bookings ({bookings.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ride Info</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fare/Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 whitespace-nowrap text-center text-gray-500 dark:text-gray-400">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{b.pickup} to {b.dropoff}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{b.vehicleType} | {b.distance}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900 dark:text-white">{b.userEmail}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(b.dateTime).toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">{b.fare}</p>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getStatusClasses(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        {b.status === 'Pending' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'Accepted')}
                            className="p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700"
                            title="Accept Ride"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        {b.status === 'Accepted' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'Completed')}
                            className="p-2 text-white bg-green-600 rounded-full hover:bg-green-700"
                            title="Mark Completed"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        {b.status !== 'Canceled' && b.status !== 'Completed' && (
                          <button
                            onClick={() => handleUpdateStatus(b.id, 'Canceled')}
                            className="p-2 text-white bg-red-600 rounded-full hover:bg-red-700"
                            title="Reject/Cancel Ride"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Drivers</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mock: Driver accounts would be managed here.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Users</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mock: User profiles and data management.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Records</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mock: View successful transactions and payouts.</p>
        </div>
      </div>
    </div>
  );
};

const LoginSignupView = ({ auth, setCurrentPage, setUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
        setCurrentPage('home');
      } else {
        // Signup
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
        setCurrentPage('home');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Try logging in.');
      } else if (err.code === 'auth/invalid-email' || err.code === 'auth/weak-password' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid credentials or password is too weak (min 6 characters).');
      } else {
        setError(`Authentication failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-center mb-6 text-indigo-600 dark:text-indigo-400">
          {isLogin ? 'Welcome Back!' : 'Create Account'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900/50 rounded-lg border border-red-300 dark:border-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-lg shadow-indigo-500/50 disabled:opacity-60 flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </>
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Log In
              </>
            ) : (
              <>
                <User className="w-5 h-5 mr-2" />
                Sign Up
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
};

const ContactAboutView = () => (
  <div className="max-w-4xl mx-auto p-4 md:p-8">
    <h1 className="text-4xl font-extrabold mb-8 text-gray-900 dark:text-white">
      About RideSwift & Contact Us
    </h1>

    {/* About Section */}
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 mb-8">
      <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Our Mission</h2>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
        RideSwift is committed to providing fast, reliable, and affordable transportation options across the city. Whether you need a quick bike ride, an economical auto, or a comfortable cab, our platform connects you with the right vehicle in seconds. Our real-time booking, fair pricing, and professional driver network ensure a seamless travel experience every time.
      </p>
    </div>

    {/* Contact Section */}
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Get In Touch</h2>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400 flex items-center">
          <MapPin className="w-5 h-5 mr-3 text-indigo-500 flex-shrink-0" />
          **Office:** 123 Transport Lane, City Center, 90210
        </p>
        <p className="text-gray-600 dark:text-gray-400 flex items-center">
          <Clock className="w-5 h-5 mr-3 text-indigo-500 flex-shrink-0" />
          **Hours:** 24/7 Support Available
        </p>
        <p className="text-gray-600 dark:text-gray-400 flex items-center">
          <Send className="w-5 h-5 mr-3 text-indigo-500 flex-shrink-0" />
          **Email:** support@rideswift.com (Mock)
        </p>
      </div>
      <button
        onClick={() => alert("Mock Contact Form: This would submit a message to our support team.")}
        className="mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-md"
      >
        Send a Message
      </button>
    </div>
  </div>
);

const NotAuthenticatedMessage = () => (
  <div className="flex justify-center items-center min-h-[60vh] p-4 text-center">
    <div className="max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
      <LogIn className="w-12 h-12 mx-auto mb-4 text-red-500" />
      <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
        Authentication Required
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Please log in or sign up to view your dashboard and manage bookings.
      </p>
      <a href="#" onClick={() => { window.location.hash = 'login'; }} className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition duration-300 shadow-md">
        Go to Login
      </a>
    </div>
  </div>
);


// --- Main Application Component ---

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [mode, setMode] = useState('light'); // 'light' or 'dark'

  const { db, auth, user, isLoading } = useFirebase();
  const { bookings, isBookingsLoading } = useBookings(db, user?.uid);

  useEffect(() => {
    // Apply dark mode class to the body
    document.body.className = mode === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50';
  }, [mode]);

  const toggleMode = () => {
    setMode(prevMode => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const renderPage = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    switch (currentPage) {
      case 'home':
        return <HomeView setCurrentPage={setCurrentPage} user={user} db={db} />;
      case 'vehicle-details':
        return <VehicleDetailsView setCurrentPage={setCurrentPage} />;
      case 'login':
        return <LoginSignupView auth={auth} setCurrentPage={setCurrentPage} setUser={(u) => console.log('User set:', u)} />;
      case 'dashboard':
        return <UserDashboardView user={user} db={db} bookings={bookings} isBookingsLoading={isBookingsLoading} />;
      case 'admin':
        return <AdminDashboardView user={user} db={db} bookings={bookings} isBookingsLoading={isBookingsLoading} />;
      case 'contact':
        return <ContactAboutView />;
      default:
        return <HomeView setCurrentPage={setCurrentPage} user={user} db={db} />;
    }
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${mode === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Header
        user={user}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        mode={mode}
        toggleMode={toggleMode}
        auth={auth}
      />
      <main className="pt-20 pb-12">
        {renderPage()}
      </main>
      <footer className="w-full text-center py-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        &copy; {new Date().getFullYear()} RideSwift. All rights reserved. | App ID: {appId} | User ID: {user?.uid || 'N/A'}
      </footer>
    </div>
  );
};

// Default export is required for React single-file applications
export default App;
