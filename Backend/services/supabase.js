const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase Client Connected Successfully.');
} else {
  console.log('ℹ️ Supabase credentials not provided. Using Local JSON Fallback mode.');
}

const dataDir = path.join(__dirname, '..', 'data');
const bookingsFile = path.join(dataDir, 'bookings.json');
const parcelsFile = path.join(dataDir, 'parcels.json');
const driversFile = path.join(dataDir, 'drivers.json');
const riderApplicationsFile = path.join(dataDir, 'rider_applications.json');
const feedbackFile = path.join(dataDir, 'feedback.json');
const configFile = path.join(dataDir, 'config.json');
const payoutRequestsFile = path.join(dataDir, 'payout_requests.json');

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

const defaultRiderApplications = [
  {
    id: 'app-demo-001',
    name: 'Mukesh Kumar Sharma',
    phone: '9829012345',
    city: 'Jaipur (Mansarovar / Vaishali)',
    shift: 'Full Time (8-10 Hours)',
    vehType: 'Bike / Scooter',
    vehNum: 'RJ14 AB 1234',
    dlNum: 'RJ14 20210012345',
    status: 'Approved',
    driverId: 'RDR-2345',
    pin: '4321',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    approved_at: new Date(Date.now() - 86400000).toISOString()
  }
];

const defaultConfig = {
  rates: {
    baseRate: 2200,
    perKmRate: 25,
    floorNoLiftRate: 250,
    houseSizeRates: {
      '1rk': 0,
      '1bhk': 800,
      '2bhk': 2300,
      '3bhk': 4000,
      'villa': 7300
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
    'mini_truck': { name: 'Tata Ace (Chota Hathi 750kg)', basePrice: 2200, perKmRate: 25, icon: 'fa-truck-pickup', cap: '1 BHK / Partial Household' },
    'tempo_14ft': { name: 'Canter 14ft / Tempo (3.5 Ton)', basePrice: 3500, perKmRate: 30, icon: 'fa-truck', cap: 'Ideal for 2-3 BHK Shifting' },
    'truck_19ft': { name: 'Tata 407 / 19ft Container (7 Ton)', basePrice: 5500, perKmRate: 50, icon: 'fa-truck-moving', cap: '3+ BHK / Industrial Moving' },
    'bike': { name: 'Bike Carrier (Up to 150cc)', basePrice: 2500, perKmRate: 15, icon: 'fa-motorcycle', cap: 'Two-Wheeler Dedicated Carrier' },
    'car': { name: 'Closed Car Carrier Trailer', basePrice: 6000, perKmRate: 25, icon: 'fa-car-side', cap: 'Hydraulic Closed Car Carrier' }
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
  parcelRates: {
    bike: { name: 'Bike Express', baseFare: 48, perKmRate: 10, baseKm: 1, maxWeightKg: 20, icon: 'fa-motorcycle', desc: 'Up to 20 KG • Docs & Small Parcels' },
    auto: { name: 'Auto / 3-Wheeler', baseFare: 135, perKmRate: 14, baseKm: 2, maxWeightKg: 500, icon: 'fa-truck-front', desc: 'Up to 500 KG • Wholesale & 1 RK' },
    mini_truck: { name: 'Tata Ace (Chota Hathi)', baseFare: 220, perKmRate: 25, baseKm: 3, maxWeightKg: 750, icon: 'fa-truck-pickup', desc: 'Up to 750 KG • Heavy Relocation' },
    weightSurcharges: {
      'upto_1kg': 0,
      '1_5kg': 20,
      '5_10kg': 30,
      '10_20kg': 60,
      '20_50kg': 120,
      '50kg_plus': 250
    },
    addons: {
      fragile: 25,
      packaging: 40,
      insurance: 49,
      express: 50
    },
    handlingFee: 10,
    gstPercent: 18
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
      try {
        const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          return data.map(b => ({
            ...b,
            pickup_otp: b.pickup_otp || (b.notes && b.notes.match(/PICKUP_PIN:(\d{4})/)?.[1]) || '3821'
          }));
        }
        console.warn('Supabase bookings read fallback to local:', error?.message || 'empty response');
      } catch (err) {
        console.warn('Supabase bookings read fallback to local:', err.message);
      }
    }
    const local = await readLocal(bookingsFile, []);
    return local.map(b => ({
      ...b,
      pickup_otp: b.pickup_otp || (b.notes && b.notes.match(/PICKUP_PIN:(\d{4})/)?.[1]) || '3821'
    }));
  },

  async getBookingByIdOrPhone(identifier) {
    const cleanId = String(identifier).trim();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, drivers(*)')
          .or(`id.eq.${cleanId},customer_phone.eq.${cleanId}`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) {
          const b = data[0];
          b.pickup_otp = b.pickup_otp || (b.notes && b.notes.match(/PICKUP_PIN:(\d{4})/)?.[1]) || '3821';
          return b;
        }
        if (error) console.warn('Supabase booking lookup fallback to local:', error.message);
      } catch (err) {
        console.warn('Supabase booking lookup fallback to local:', err.message);
      }
    }

    const bookings = await readLocal(bookingsFile, []);
    const phoneClean = cleanId.replace(/\D/g, '');
    const found = bookings.find(b => 
      b.id?.toLowerCase() === cleanId.toLowerCase() || 
      (phoneClean && b.customer_phone?.replace(/\D/g, '') === phoneClean)
    );
    if (found) {
      found.pickup_otp = found.pickup_otp || (found.notes && found.notes.match(/PICKUP_PIN:(\d{4})/)?.[1]) || '3821';
    }
    return found || null;
  },

  async createBooking(bookingData) {
    const pickupOtp = bookingData.pickup_otp || String(Math.floor(1000 + Math.random() * 9000));
    bookingData.pickup_otp = pickupOtp;
    if (!bookingData.notes || !bookingData.notes.includes('PICKUP_PIN:')) {
      bookingData.notes = bookingData.notes ? `${bookingData.notes} | PICKUP_PIN:${pickupOtp}` : `PICKUP_PIN:${pickupOtp}`;
    }

    if (supabase) {
      try {
        const { pickup_otp, ...dbData } = bookingData;
        const { data, error } = await supabase.from('bookings').insert([dbData]).select().single();
        if (!error && data) {
          data.pickup_otp = pickupOtp;
          return data;
        }
        console.warn('Supabase booking insert fallback to local:', error?.message || 'empty response');
      } catch (err) {
        console.warn('Supabase booking insert fallback to local:', err.message);
      }
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
  async getRiderApplications() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('rider_applications').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          return data.map(r => ({
            ...r,
            vehType: r.vehtype || r.vehType || 'Bike / Scooter',
            vehNum: r.vehnum || r.vehNum || '',
            dlNum: r.dlnum || r.dlNum || '',
            driverId: r.driverid || r.driverId || r.driver_id
          }));
        }
        console.warn('Supabase rider applications read fallback to local:', error?.message || 'empty response');
      } catch (err) {
        console.warn('Supabase rider applications read fallback to local:', err.message);
      }
    }
    return await readLocal(riderApplicationsFile, defaultRiderApplications);
  },

  async createRiderApplication(payload) {
    const dbPayload = {
      id: payload.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: payload.name,
      phone: String(payload.phone || '').replace(/\D/g, ''),
      city: payload.city,
      shift: payload.shift || 'Full Time (8-10 Hours)',
      vehtype: payload.vehType || payload.vehtype || 'Bike / Scooter',
      vehnum: payload.vehNum || payload.vehnum || '',
      dlnum: payload.dlNum || payload.dlnum || '',
      status: payload.status || 'Pending',
      driverid: payload.driverId || payload.driverid || null,
      pin: payload.pin || null,
      date: payload.date || new Date().toISOString(),
      created_at: payload.created_at || new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('rider_applications').insert([dbPayload]).select().single();
        if (!error && data) {
          return {
            ...data,
            vehType: data.vehtype,
            vehNum: data.vehnum,
            dlNum: data.dlnum,
            driverId: data.driverid
          };
        }
        console.warn('Supabase rider application insert fallback to local:', error?.message || 'empty response');
      } catch (err) {
        console.warn('Supabase rider application insert fallback to local:', err.message);
      }
    }
    const apps = await readLocal(riderApplicationsFile, defaultRiderApplications);
    const newApp = { ...dbPayload, vehType: dbPayload.vehtype, vehNum: dbPayload.vehnum, dlNum: dbPayload.dlnum };
    apps.unshift(newApp);
    await writeLocal(riderApplicationsFile, apps);
    return newApp;
  },

  async updateRiderApplication(id, updates) {
    const dbUpdates = { ...updates };
    if ('vehType' in updates) { dbUpdates.vehtype = updates.vehType; delete dbUpdates.vehType; }
    if ('vehNum' in updates) { dbUpdates.vehnum = updates.vehNum; delete dbUpdates.vehNum; }
    if ('dlNum' in updates) { dbUpdates.dlnum = updates.dlNum; delete dbUpdates.dlNum; }
    if ('driverId' in updates) { dbUpdates.driverid = updates.driverId; delete dbUpdates.driverId; }

    if (supabase) {
      try {
        const { data, error } = await supabase.from('rider_applications').update(dbUpdates).eq('id', id).select().single();
        if (!error && data) {
          return {
            ...data,
            vehType: data.vehtype,
            vehNum: data.vehnum,
            dlNum: data.dlnum,
            driverId: data.driverid
          };
        }
        console.warn('Supabase rider application update fallback to local:', error?.message || 'empty response');
      } catch (err) {
        console.warn('Supabase rider application update fallback to local:', err.message);
      }
    }
    const apps = await readLocal(riderApplicationsFile, defaultRiderApplications);
    const index = apps.findIndex(app => app.id === id);
    if (index === -1) return null;
    apps[index] = { ...apps[index], ...updates, updated_at: new Date().toISOString() };
    await writeLocal(riderApplicationsFile, apps);
    return apps[index];
  },

  async getDrivers() {
    let list = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) list = data;
      } catch (err) {
        console.warn('Supabase getDrivers warning:', err.message);
      }
    }
    if (!list || list.length === 0) {
      list = await readLocal(driversFile, defaultDrivers);
    }

    // Enrich driver list with security PIN, approval date, and onDuty status from applications
    try {
      const apps = await this.getRiderApplications();
      list = list.map(d => {
        const dPhone = String(d.phone || '').replace(/\D/g, '');
        const matchedApp = apps.find(a => String(a.phone || '').replace(/\D/g, '') === dPhone);
        return {
          ...d,
          pin: matchedApp?.pin || d.pin || '1234',
          onDuty: d.onDuty !== undefined ? d.onDuty : (d.status !== 'off_duty'),
          approved_at: matchedApp?.approved_at || d.approved_at || d.created_at,
          vehicle_number: d.vehicle_number || matchedApp?.vehNum || '',
          vehicle_type: d.vehicle_type || matchedApp?.vehType || 'Bike / Scooter'
        };
      });
    } catch {}

    return list;
  },

  async createDriver(driverData) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const dbPayload = {
      id: (driverData.id && isUuid.test(driverData.id)) ? driverData.id : crypto.randomUUID(),
      driver_name: driverData.driver_name || driverData.name || 'Rider Partner',
      phone: String(driverData.phone || '').replace(/\D/g, ''),
      vehicle_number: driverData.vehicle_number || driverData.vehNum || '',
      vehicle_type: driverData.vehicle_type || driverData.vehType || 'Bike / Scooter',
      status: driverData.status || 'available',
      current_location: driverData.current_location || null,
      rating: Number(driverData.rating || 4.8),
      created_at: driverData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const { data, error } = await supabase.from('drivers').insert([dbPayload]).select().single();
        if (!error && data) {
          return { ...driverData, ...data };
        }
        console.warn('Supabase create driver warning:', error?.message);
      } catch (err) {
        console.warn('Supabase create driver error:', err.message);
      }
    }

    const drivers = await readLocal(driversFile, defaultDrivers);
    const newDriver = { ...driverData, ...dbPayload };
    drivers.unshift(newDriver);
    await writeLocal(driversFile, drivers);
    return newDriver;
  },

  async updateDriver(id, driverData) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allowed = ['driver_name', 'phone', 'vehicle_number', 'vehicle_type', 'status', 'current_location', 'rating', 'updated_at'];
    const dbUpdates = {};
    for (const key of allowed) {
      if (key in driverData && driverData[key] !== undefined) dbUpdates[key] = driverData[key];
    }
    dbUpdates.updated_at = new Date().toISOString();

    if (supabase && id && isUuid.test(id)) {
      try {
        const { data, error } = await supabase.from('drivers').update(dbUpdates).eq('id', id).select().single();
        if (!error && data) {
          return { ...driverData, ...data };
        }
        console.warn('Supabase update driver warning:', error?.message);
      } catch (err) {
        console.warn('Supabase update driver error:', err.message);
      }
    }

    const drivers = await readLocal(driversFile, defaultDrivers);
    const index = drivers.findIndex(d => d.id === id || String(d.phone || '').replace(/\D/g, '') === String(driverData.phone || '').replace(/\D/g, ''));
    if (index === -1) return null;
    drivers[index] = { ...drivers[index], ...driverData, ...dbUpdates };
    await writeLocal(driversFile, drivers);
    return drivers[index];
  },

  async getDriverById(id) {
    let result = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
        if (!error && data) result = data;
      } catch {}
    }
    const drivers = await readLocal(driversFile, defaultDrivers);
    const local = drivers.find(d => d.id === id);
    if (!result) return local || null;
    return { ...local, ...result, avatar_url: local?.avatar_url || result?.avatar_url || null };
  },

  async getDriverByPhone(phone) {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    let result = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('drivers').select('*').limit(100);
        if (!error && Array.isArray(data)) {
          const found = data.find(d => String(d.phone || '').replace(/\D/g, '') === cleanPhone);
          if (found) result = found;
        }
      } catch {}
    }
    const drivers = await readLocal(driversFile, defaultDrivers);
    const local = drivers.find(d => String(d.phone || '').replace(/\D/g, '') === cleanPhone);
    if (!result) return local || null;
    return { ...local, ...result, avatar_url: local?.avatar_url || result?.avatar_url || null };
  },

  // PAYOUT REQUESTS
  async getPayoutRequests(driverId = null) {
    if (supabase) {
      try {
        let query = supabase.from('payout_requests').select('*').order('created_at', { ascending: false });
        if (driverId) query = query.eq('driver_id', driverId);
        const { data, error } = await query;
        if (!error && data) return data;
      } catch {}
    }
    const list = await readLocal(payoutRequestsFile, []);
    if (driverId) {
      return list.filter(item => item.driver_id === driverId);
    }
    return list;
  },

  async createPayoutRequest(payload) {
    const item = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('payout_requests').insert([item]).select().single();
        if (!error && data) return data;
      } catch {}
    }
    const list = await readLocal(payoutRequestsFile, []);
    list.unshift(item);
    await writeLocal(payoutRequestsFile, list);
    return item;
  },

  async updatePayoutStatus(id, status, notes = '') {
    const updatePayload = {
      status,
      notes: notes || '',
      updated_at: new Date().toISOString()
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('payout_requests').update(updatePayload).eq('id', id).select().single();
        if (!error && data) return data;
      } catch {}
    }
    const list = await readLocal(payoutRequestsFile, []);
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updatePayload };
    await writeLocal(payoutRequestsFile, list);
    return list[idx];
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

  // PARCELS MANAGEMENT (Porter-style on-demand delivery)
  async getParcels() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('parcel_bookings').select('*').order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch {}
    }
    return await readLocal(parcelsFile, []);
  },

  async getParcelByIdOrPhone(identifier) {
    const cleanId = String(identifier).trim();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('parcel_bookings')
          .select('*')
          .or(`parcel_id.ilike.%${cleanId}%,sender_phone.eq.${cleanId},receiver_phone.eq.${cleanId}`)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && data && data.length > 0) return data[0];
      } catch {}
    }

    const parcels = await readLocal(parcelsFile, []);
    const phoneClean = cleanId.replace(/\D/g, '');
    return parcels.find(p => 
      (p.parcel_id && p.parcel_id.toLowerCase() === cleanId.toLowerCase()) ||
      (p.id && p.id.toLowerCase() === cleanId.toLowerCase()) ||
      (phoneClean && p.sender_phone && p.sender_phone.replace(/\D/g, '') === phoneClean) ||
      (phoneClean && p.receiver_phone && p.receiver_phone.replace(/\D/g, '') === phoneClean)
    ) || null;
  },

  async createParcel(parcelData) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('parcel_bookings').insert([parcelData]).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase parcel insert fallback to local:', err.message);
      }
    }

    const parcels = await readLocal(parcelsFile, []);
    parcels.unshift(parcelData);
    await writeLocal(parcelsFile, parcels);
    return parcelData;
  },

  async _saveParcelUpdate(parcel, updatePayload) {
    const parcelKey = parcel.parcel_id || parcel.id;
    let updatedParcel = null;

    // 1. Supabase database update
    if (supabase && parcelKey) {
      try {
        const { data, error } = await supabase
          .from('parcel_bookings')
          .update(updatePayload)
          .or(`parcel_id.eq.${parcelKey},id.eq.${parcelKey}`)
          .select()
          .single();
        if (!error && data) {
          updatedParcel = data;
        } else if (error) {
          console.warn('[Supabase] parcel update notice:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase] parcel update exception:', err.message);
      }
    }

    // 2. Always sync with local data storage (Backend/data/parcels.json)
    try {
      const parcels = await readLocal(parcelsFile, []);
      const index = parcels.findIndex(p => 
        (p.parcel_id && String(p.parcel_id).toLowerCase() === String(parcelKey).toLowerCase()) || 
        (p.id && String(p.id).toLowerCase() === String(parcelKey).toLowerCase())
      );
      if (index !== -1) {
        parcels[index] = { ...parcels[index], ...updatePayload };
        await writeLocal(parcelsFile, parcels);
        if (!updatedParcel) updatedParcel = parcels[index];
      } else {
        const merged = { ...parcel, ...updatePayload };
        parcels.unshift(merged);
        await writeLocal(parcelsFile, parcels);
        if (!updatedParcel) updatedParcel = merged;
      }
    } catch (localErr) {
      console.warn('[Local] parcels save notice:', localErr.message);
    }

    return updatedParcel || { ...parcel, ...updatePayload };
  },

  async updateParcelStatus(id, status, updatedBy = 'system', notes = '') {
    const cleanId = String(id || '').trim();
    let parcel = await this.getParcelByIdOrPhone(cleanId);
    if (!parcel) {
      const parcels = await this.getParcels();
      parcel = parcels.find(p => 
        (p.parcel_id && p.parcel_id.toLowerCase() === cleanId.toLowerCase()) || 
        (p.id && String(p.id).toLowerCase() === cleanId.toLowerCase())
      );
    }
    if (!parcel) parcel = { parcel_id: cleanId, id: cleanId };

    const updatePayload = {
      booking_status: status,
      status: status,
      updated_at: new Date().toISOString()
    };
    if (notes) updatePayload.notes = notes;
    if (status === 'picked_up') {
      updatePayload.pickup_time = new Date().toISOString();
      updatePayload.pickup_otp_verified = true;
    }
    if (status === 'delivered') {
      updatePayload.delivery_time = new Date().toISOString();
      updatePayload.delivery_otp_verified = true;
      updatePayload.pickup_otp_verified = true;
      updatePayload.payment_status = 'completed';
    }

    return await this._saveParcelUpdate(parcel, updatePayload);
  },

  async assignParcelDriver(id, driverInfo) {
    const cleanId = String(id || '').trim();
    let parcel = await this.getParcelByIdOrPhone(cleanId);
    if (!parcel) {
      const parcels = await this.getParcels();
      parcel = parcels.find(p => 
        (p.parcel_id && p.parcel_id.toLowerCase() === cleanId.toLowerCase()) || 
        (p.id && String(p.id).toLowerCase() === cleanId.toLowerCase())
      );
    }
    if (!parcel) parcel = { parcel_id: cleanId, id: cleanId };

    const payload = {
      driver_id: driverInfo.driver_id || driverInfo.id,
      assigned_driver_name: driverInfo.driver_name || driverInfo.name,
      assigned_driver_phone: driverInfo.driver_phone || driverInfo.phone,
      assigned_vehicle_no: driverInfo.vehicle_number || driverInfo.vehicleNo,
      assigned_vehicle_type: driverInfo.vehicle_type || driverInfo.vehicleType,
      booking_status: 'driver_assigned',
      status: 'driver_assigned',
      updated_at: new Date().toISOString()
    };

    if (driverInfo.pickup_otp) payload.pickup_otp = driverInfo.pickup_otp;
    if (driverInfo.delivery_otp) payload.delivery_otp = driverInfo.delivery_otp;

    return await this._saveParcelUpdate(parcel, payload);
  },

  async assignParcelOtps(id, pickupOtp, deliveryOtp) {
    const cleanId = String(id || '').trim();
    let parcel = await this.getParcelByIdOrPhone(cleanId);
    if (!parcel) {
      const parcels = await this.getParcels();
      parcel = parcels.find(p => 
        (p.parcel_id && p.parcel_id.toLowerCase() === cleanId.toLowerCase()) || 
        (p.id && String(p.id).toLowerCase() === cleanId.toLowerCase())
      );
    }
    if (!parcel) parcel = { parcel_id: cleanId, id: cleanId };

    const payload = {
      pickup_otp: String(pickupOtp || '').trim(),
      delivery_otp: String(deliveryOtp || '').trim(),
      updated_at: new Date().toISOString()
    };

    return await this._saveParcelUpdate(parcel, payload);
  },

  async verifyParcelOtp(id, otpType, enteredOtp) {
    const cleanId = String(id || '').trim();
    let parcel = await this.getParcelByIdOrPhone(cleanId);
    if (!parcel) {
      const parcels = await this.getParcels();
      parcel = parcels.find(p => 
        (p.parcel_id && p.parcel_id.toLowerCase() === cleanId.toLowerCase()) || 
        (p.id && String(p.id).toLowerCase() === cleanId.toLowerCase())
      );
    }
    if (!parcel) throw new Error(`Parcel not found with ID: ${id}`);

    const cleanEntered = String(enteredOtp || '').replace(/\D/g, '').trim();
    if (!cleanEntered || cleanEntered.length < 4) {
      throw new Error('Please enter a valid 4-digit PIN.');
    }

    if (otpType === 'pickup') {
      if (parcel.pickup_otp_verified && (parcel.booking_status === 'picked_up' || parcel.status === 'picked_up')) {
        throw new Error('Pickup OTP has already been verified.');
      }
      const expectedPickup = String(parcel.pickup_otp || '').replace(/\D/g, '').trim();
      if (expectedPickup && cleanEntered !== expectedPickup) {
        throw new Error('Invalid Pickup OTP. Please check with the sender.');
      }

      const updatePayload = {
        booking_status: 'picked_up',
        status: 'picked_up',
        pickup_otp_verified: true,
        pickup_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return await this._saveParcelUpdate(parcel, updatePayload);

    } else if (otpType === 'delivery') {
      if (parcel.delivery_otp_verified && (parcel.booking_status === 'delivered' || parcel.status === 'delivered')) {
        throw new Error('Delivery OTP has already been verified. Parcel is already delivered.');
      }
      const expectedDelivery = String(parcel.delivery_otp || '').replace(/\D/g, '').trim();
      if (expectedDelivery && cleanEntered !== expectedDelivery) {
        throw new Error('Invalid Delivery OTP. Please check with the receiver.');
      }

      // Mark delivered, mark both delivery and pickup OTP verified, and complete payment atomically
      const updatePayload = {
        booking_status: 'delivered',
        status: 'delivered',
        pickup_otp_verified: true,
        delivery_otp_verified: true,
        payment_status: 'completed',
        delivery_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return await this._saveParcelUpdate(parcel, updatePayload);
    }

    throw new Error('Invalid OTP type');
  },

  async markParcelOtpVerified(parcel, otpType) {
    const field = otpType === 'pickup' ? 'pickup_otp_verified' : 'delivery_otp_verified';
    return await this._saveParcelUpdate(parcel, {
      [field]: true,
      updated_at: new Date().toISOString()
    });
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
