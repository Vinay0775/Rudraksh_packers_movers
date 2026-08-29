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
  }
};
