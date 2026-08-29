const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase Client Connected Successfully.');
} else {
  console.log('ℹ️ Supabase credentials not provided. Using Local JSON Fallback mode.');
}

const dataDir = path.join(__dirname, '..', 'data');
const bookingsFile = path.join(dataDir, 'bookings.json');
const driversFile = path.join(dataDir, 'drivers.json');
const feedbackFile = path.join(dataDir, 'feedback.json');
const configFile = path.join(dataDir, 'config.json');

async function readLocal(file, defaultData = []) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeLocal(file, defaultData);
      return defaultData;
    }
    return defaultData;
  }
}

async function writeLocal(file, data) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Initial Sample Drivers for local mode
const defaultDrivers = [
  { id: 'drv-101', driver_name: 'Rajesh Kumar', phone: '9876543210', vehicle_number: 'RJ-14-GA-1024', vehicle_type: 'Tata Ace (1.5 Ton)', status: 'available', rating: 4.9 },
  { id: 'drv-102', driver_name: 'Vikram Singh', phone: '9829012345', vehicle_number: 'RJ-14-GB-5521', vehicle_type: 'Eicher 14ft (3.5 Ton)', status: 'available', rating: 4.8 },
  { id: 'drv-103', driver_name: 'Ramesh Meena', phone: '9414098765', vehicle_number: 'RJ-14-GC-8840', vehicle_type: '19ft Container (7 Ton)', status: 'available', rating: 4.7 }
];

const defaultConfig = {
  rates: {
    baseRate: 2500,
    perKmRate: 40,
    floorNoLiftRate: 300,
    houseSizeRates: {
      '1rk': 0,
      '1bhk': 1000,
      '2bhk': 2500,
      '3bhk': 4500,
      'villa': 7500
    },
    itemRates: {
      sofa: 500,
      bed: 600,
      dining: 400,
      fridge: 400,
      washing: 350,
      boxes: 80
    },
    addonRates: {
      bubblePacking: 1500,
      unpacking: 1200,
      insurance: 999,
      vehicleTransport: 2500
    }
  },
  vehicles: {
    'mini_truck': { name: 'Tata Ace / Mini (1.5 Ton)', basePrice: 2500, perKmRate: 35, icon: 'fa-truck-pickup', cap: 'Up to 1 BHK / Studio' },
    'tempo_14ft': { name: '14ft Tempo / Eicher (3.5 Ton)', basePrice: 3500, perKmRate: 45, icon: 'fa-truck', cap: 'Ideal for 1-2 BHK' },
    'truck_19ft': { name: '19ft Container Truck (7 Ton)', basePrice: 5500, perKmRate: 65, icon: 'fa-truck-moving', cap: '3+ BHK / Large Moving' },
    'bike': { name: 'Bike Transport Carrier', basePrice: 1500, perKmRate: 15, icon: 'fa-motorcycle', cap: 'Two-Wheeler Carrier' },
    'car': { name: 'Closed Car Carrier', basePrice: 4500, perKmRate: 35, icon: 'fa-car-side', cap: 'Hydraulic Car Carrier' }
  },
  coupons: [
    { code: 'FIRST500', type: 'fixed', value: 500, description: '₹500 flat off on first relocation' },
    { code: 'RELOCATE10', type: 'percent', value: 10, description: '10% discount on house shifting' },
    { code: 'FESTIVE15', type: 'percent', value: 15, description: '15% festive seasonal off' }
  ],
  company: {
    name: 'Rudraksha Packers & Movers',
    phone: '7296831460',
    whatsapp: '7296831460',
    email: 'support@rudrakshapackers.com',
    address: 'Near SNM Hospital, Gandhipath (West), Jaipur, RJ',
    gstin: '08AAACR1234F1Z5'
  },
  theme: {
    primaryColor: '#f97316',
    secondaryColor: '#1e293b',
    accentColor: '#06b6d4'
  }
};

module.exports = {
  isSupabaseActive: () => Boolean(supabase),

  // BOOKINGS
  async getBookings() {
    if (supabase) {
      const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return await readLocal(bookingsFile, []);
  },

  async getBookingByIdOrPhone(identifier) {
    const cleanId = String(identifier).trim();
    if (supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, drivers(*)')
        .or(`id.ilike.%${cleanId}%,customer_phone.eq.${cleanId}`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    }

    const bookings = await readLocal(bookingsFile, []);
    const phoneClean = cleanId.replace(/\D/g, '');
    return bookings.find(b => 
      b.id?.toLowerCase() === cleanId.toLowerCase() || 
      (phoneClean && b.customer_phone?.replace(/\D/g, '') === phoneClean)
    ) || null;
  },

  async createBooking(bookingData) {
    if (supabase) {
      const { data, error } = await supabase.from('bookings').insert([bookingData]).select().single();
      if (error) throw error;
      return data;
    }

    const bookings = await readLocal(bookingsFile, []);
    bookings.unshift(bookingData);
    await writeLocal(bookingsFile, bookings);
    return bookingData;
  },

  async updateBookingStatus(id, status, notes = '') {
    if (supabase) {
      const updatePayload = { status, updated_at: new Date().toISOString() };
      if (notes) updatePayload.notes = notes;
      const { data, error } = await supabase.from('bookings').update(updatePayload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const bookings = await readLocal(bookingsFile, []);
    const index = bookings.findIndex(b => b.id === id);
    if (index === -1) return null;
    bookings[index].status = status;
    if (notes) bookings[index].notes = notes;
    bookings[index].updated_at = new Date().toISOString();
    await writeLocal(bookingsFile, bookings);
    return bookings[index];
  },

  async assignDriverToBooking(id, driverInfo) {
    if (supabase) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(driverInfo.driver_id || '');
      const updatePayload = {
        assigned_driver_id: isUuid ? driverInfo.driver_id : null,
        assigned_driver_name: driverInfo.driver_name,
        assigned_driver_phone: driverInfo.driver_phone,
        assigned_vehicle_no: driverInfo.vehicle_number,
        status: 'driver_assigned',
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('bookings').update(updatePayload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const bookings = await readLocal(bookingsFile, []);
    const index = bookings.findIndex(b => b.id === id);
    if (index === -1) return null;
    bookings[index] = {
      ...bookings[index],
      assigned_driver_id: driverInfo.driver_id || null,
      assigned_driver_name: driverInfo.driver_name,
      assigned_driver_phone: driverInfo.driver_phone,
      assigned_vehicle_no: driverInfo.vehicle_number,
      status: 'driver_assigned',
      updated_at: new Date().toISOString()
    };
    await writeLocal(bookingsFile, bookings);
    return bookings[index];
  },

  // DRIVERS
  async getDrivers() {
    if (supabase) {
      const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return await readLocal(driversFile, defaultDrivers);
  },

  async createDriver(driverData) {
    if (supabase) {
      const { data, error } = await supabase.from('drivers').insert([driverData]).select().single();
      if (error) throw error;
      return data;
    }

    const drivers = await readLocal(driversFile, defaultDrivers);
    const newDriver = { id: `drv-${Date.now().toString().slice(-4)}`, ...driverData, created_at: new Date().toISOString() };
    drivers.unshift(newDriver);
    await writeLocal(driversFile, drivers);
    return newDriver;
  },

  async updateDriver(id, driverData) {
    if (supabase) {
      const { data, error } = await supabase.from('drivers').update(driverData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    const drivers = await readLocal(driversFile, defaultDrivers);
    const index = drivers.findIndex(d => d.id === id);
    if (index === -1) return null;
    drivers[index] = { ...drivers[index], ...driverData };
    await writeLocal(driversFile, drivers);
    return drivers[index];
  },

  // FEEDBACK
  async addFeedback(feedbackData) {
    if (supabase) {
      const { data, error } = await supabase.from('feedback').insert([feedbackData]).select().single();
      if (error) throw error;
      return data;
    }
    const feedbackList = await readLocal(feedbackFile, []);
    feedbackList.unshift({ id: `fb-${Date.now().toString().slice(-4)}`, ...feedbackData, created_at: new Date().toISOString() });
    await writeLocal(feedbackFile, feedbackList);
    return feedbackList[0];
  },

  // CONFIGURATION & FULL CONTROL
  async getConfig() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('system_config').select('*').limit(1);
        if (!error && data && data.length > 0 && data[0].config) {
          return { ...defaultConfig, ...data[0].config };
        }
      } catch (err) {
        console.warn('Supabase system_config table not found, using local fallback:', err.message);
      }
    }
    return await readLocal(configFile, defaultConfig);
  },

  async saveConfig(newConfig) {
    const current = await this.getConfig();
    const merged = { ...current, ...newConfig, updated_at: new Date().toISOString() };

    if (supabase) {
      try {
        await supabase.from('system_config').upsert([{ id: 1, config: merged, updated_at: new Date().toISOString() }]);
      } catch (err) {
        console.warn('Supabase config sync skipped:', err.message);
      }
    }

    await writeLocal(configFile, merged);
    return merged;
  }
};
