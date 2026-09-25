// ORDER MANAGEMENT 02 - DATABASE.JS

const DB_CONFIG = {
  supabaseUrl: "https://wcjzugrizxdxafyzexrr.supabase.co",
  supabaseAnonKey: "sb_publishable_ZpSiNbSCaGVuYKs8rZ8BKw_2PpZrxRP",
  ordersTable: "orders",
  storageBucket: "order-images"
};

let dbClient = null;
let realtimeChannel = null;

// ==================== INIT ====================

function initDatabase() {
  if (dbClient) return true;

  if (!window.supabase) {
    console.error("Supabase library পাওয়া যায়নি");
    return false;
  }

  dbClient = window.supabase.createClient(
    DB_CONFIG.supabaseUrl,
    DB_CONFIG.supabaseAnonKey
  );

  return true;
}

// ==================== ID ====================

function createOrderId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}

// ==================== PHONE FROM ORDER TEXT ====================

function extractPhone(text) {
  const value = String(text || "");

  const match = value.match(/01\d{9}/);

  return match ? match[0] : "";
}

// ==================== IMAGE UPLOAD ====================

async function uploadImages(files, orderId) {
  if (!dbClient) initDatabase();

  if (!files || files.length === 0) {
    throw new Error("অন্তত ১টি ছবি দিন।");
  }

  if (files.length > 7) {
    throw new Error("সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।");
  }

  const urls = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!file) continue;

    const extension =
      file.name && file.name.includes(".")
        ? file.name.split(".").pop().toLowerCase()
        : "jpg";

    const path =
      orderId +
      "/" +
      Date.now() +
      "-" +
      i +
      "." +
      extension;

    const { error } = await dbClient.storage
      .from(DB_CONFIG.storageBucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) {
      console.error(error);
      throw new Error(
        "ছবি Upload হয়নি: " + error.message
      );
    }

    const { data } = dbClient.storage
      .from(DB_CONFIG.storageBucket)
      .getPublicUrl(path);

    if (data && data.publicUrl) {
      urls.push(data.publicUrl);
    }
  }

  if (urls.length === 0) {
    throw new Error("ছবি Upload হয়নি।");
  }

  return urls;
}

// ==================== SAVE ORDER ====================

async function saveOrderToDatabase(options = {}) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const page = String(options.page || "").trim();

  // পুরোনো orders.html-এর orderText গ্রহণ করবে
  // customerText এলেও গ্রহণ করবে
  const customerText = String(
    options.orderText ||
    options.customerText ||
    ""
  ).trim();

  const images = options.images || [];

  const submittedBy =
    options.submittedBy || "Admin";

  const moderatorWhatsapp =
    options.moderatorWhatsapp || "";

  if (!page) {
    throw new Error("পেজ সিলেক্ট করুন।");
  }

  if (!customerText) {
    throw new Error(
      "কাস্টমারের অর্ডারের তথ্য দিন।"
    );
  }

  const phone = extractPhone(customerText);

  if (!phone) {
    throw new Error(
      "অর্ডারের তথ্যের মধ্যে ১১ সংখ্যার English মোবাইল নাম্বার দিন। যেমন: 01712345678"
    );
  }

  if (!images || images.length === 0) {
    throw new Error("অন্তত ১টি ছবি দিন।");
  }

  const orderId = createOrderId();

  const imageUrls = await uploadImages(
    images,
    orderId
  );

  const now = new Date().toISOString();

  const orderData = {
    id: orderId,
    page_name: page,
    customer_text: customerText,
    phone: phone,
    images: imageUrls,
    submitted_by: submittedBy,
    moderator_whatsapp: moderatorWhatsapp,
    status: "pending",
    emergency: false,
    courier_sent: false,
    call_status: "not_called",
    created_at: now,
    updated_at: now
  };

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .insert(orderData)
    .select()
    .single();

  if (error) {
    console.error("SAVE ERROR:", error);
    throw new Error(
      "অর্ডার Save হয়নি: " + error.message
    );
  }

  return data;
}

// ==================== LOAD ALL ====================

async function loadAllOrders() {
  if (!dbClient && !initDatabase()) return [];

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(error);
    throw error;
  }

  return data || [];
}

// ==================== PENDING ====================

async function loadPendingOrders() {
  if (!dbClient && !initDatabase()) return [];

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .select("*")
    .eq("status", "pending")
    .eq("emergency", false)
    .order("created_at", {
      ascending: true
    });

  if (error) throw error;

  return data || [];
}

// ==================== EMERGENCY ====================

async function loadEmergencyOrders() {
  if (!dbClient && !initDatabase()) return [];

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .select("*")
    .eq("emergency", true)
    .order("created_at", {
      ascending: true
    });

  if (error) throw error;

  return data || [];
}

// ==================== MOVE TO EMERGENCY ====================

async function moveOrderToEmergency(orderId) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .update({
      emergency: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ==================== REMOVE EMERGENCY ====================

async function removeEmergency(orderId) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .update({
      emergency: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ==================== CALL STATUS ====================

async function updateCallStatus(orderId, status) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const now = new Date().toISOString();

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .update({
      call_status: status,
      call_updated_at: now,
      updated_at: now
    })
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ==================== UPDATE ORDER ====================

async function updateOrder(orderId, changes = {}) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const allowed = {};

  if (changes.customer_text !== undefined) {
    allowed.customer_text =
      changes.customer_text;
  }

  if (changes.order_text !== undefined) {
    allowed.customer_text =
      changes.order_text;
  }

  if (changes.phone !== undefined) {
    allowed.phone = changes.phone;
  }

  if (changes.images !== undefined) {
    allowed.images = changes.images;
  }

  if (changes.image_urls !== undefined) {
    allowed.images = changes.image_urls;
  }

  if (changes.status !== undefined) {
    allowed.status = changes.status;
  }

  if (changes.emergency !== undefined) {
    allowed.emergency = changes.emergency;
  }

  if (changes.courier_sent !== undefined) {
    allowed.courier_sent =
      changes.courier_sent;
  }

  if (changes.call_status !== undefined) {
    allowed.call_status =
      changes.call_status;
  }

  allowed.updated_at =
    new Date().toISOString();

  const { data, error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .update(allowed)
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ==================== DELETE ====================

async function deleteOrderFromDatabase(orderId) {
  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const { error } = await dbClient
    .from(DB_CONFIG.ordersTable)
    .delete()
    .eq("id", orderId);

  if (error) throw error;

  return true;
}

// ==================== REALTIME ====================

function startOrderRealtime(callback) {
  if (!dbClient && !initDatabase()) {
    return null;
  }

  if (realtimeChannel) {
    dbClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = dbClient
    .channel("order-management-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: DB_CONFIG.ordersTable
      },
      payload => {
        if (typeof callback === "function") {
          callback(payload);
        }
      }
    )
    .subscribe();

  return realtimeChannel;
}

// ==================== STOP REALTIME ====================

function stopOrderRealtime() {
  if (dbClient && realtimeChannel) {
    dbClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ==================== PUBLIC API ====================

window.OrderDatabase = {
  init: initDatabase,
  save: saveOrderToDatabase,
  loadAll: loadAllOrders,
  loadPending: loadPendingOrders,
  loadEmergency: loadEmergencyOrders,
  emergency: moveOrderToEmergency,
  removeEmergency: removeEmergency,
  updateCall: updateCallStatus,
  update: updateOrder,
  delete: deleteOrderFromDatabase,
  realtime: startOrderRealtime,
  stopRealtime: stopOrderRealtime
};

document.addEventListener(
  "DOMContentLoaded",
  function () {
    initDatabase();
  }
);
