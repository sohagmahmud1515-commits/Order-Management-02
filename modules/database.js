/* =========================================================
   ORDER MANAGEMENT 02
   DATABASE MODULE
   Supabase + Storage + Realtime
========================================================= */

const DB_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",

  ordersTable: "orders",
  storageBucket: "order-images"
};

let dbClient = null;
let realtimeChannel = null;


/* =========================
   START DATABASE
========================= */

function initDatabase() {

  if (
    !DB_CONFIG.supabaseUrl ||
    DB_CONFIG.supabaseUrl === "YOUR_SUPABASE_URL" ||
    !DB_CONFIG.supabaseAnonKey ||
    DB_CONFIG.supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY"
  ) {
    console.warn("Supabase URL/Key এখনো বসানো হয়নি।");
    return false;
  }

  if (!window.supabase) {
    console.error("Supabase library পাওয়া যায়নি।");
    return false;
  }

  dbClient = window.supabase.createClient(
    DB_CONFIG.supabaseUrl,
    DB_CONFIG.supabaseAnonKey
  );

  console.log("Database connected.");

  return true;
}


/* =========================
   CREATE UNIQUE ID
========================= */

function createOrderId() {

  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}


/* =========================
   IMAGE UPLOAD
========================= */

async function uploadOrderImages(files, orderId) {

  if (!dbClient) {
    throw new Error("Database connected নয়।");
  }

  const urls = [];

  for (let i = 0; i < files.length; i++) {

    const file = files[i];

    const extension =
      (file.name.split(".").pop() || "jpg")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

    const filePath =
      `${orderId}/${Date.now()}-${i}.${extension}`;

    const { error: uploadError } =
      await dbClient.storage
        .from(DB_CONFIG.storageBucket)
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    const { data } =
      dbClient.storage
        .from(DB_CONFIG.storageBucket)
        .getPublicUrl(filePath);

    if (data && data.publicUrl) {
      urls.push(data.publicUrl);
    }
  }

  return urls;
}


/* =========================
   SAVE ORDER
========================= */

async function saveOrderToDatabase({
  page,
  orderText,
  images,
  submittedBy = "Admin",
  moderatorWhatsapp = ""
}) {

  if (!dbClient) {

    const connected = initDatabase();

    if (!connected) {
      throw new Error(
        "Supabase connection তৈরি হয়নি। URL এবং Key পরীক্ষা করুন।"
      );
    }
  }

  if (!page) {
    throw new Error("পেজ সিলেক্ট করুন।");
  }

  if (!orderText || !orderText.trim()) {
    throw new Error("অর্ডারের তথ্য দিন।");
  }

  if (!images || images.length < 1) {
    throw new Error("অন্তত ১টি ছবি দিন।");
  }

  if (images.length > 7) {
    throw new Error("সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।");
  }

  const orderId = createOrderId();

  const imageUrls =
    await uploadOrderImages(
      images,
      orderId
    );

  const now =
    new Date().toISOString();

  const orderData = {

    id: orderId,

    page_name: page,

    order_text: orderText.trim(),

    image_urls: imageUrls,

    submitted_by: submittedBy,

    moderator_whatsapp: moderatorWhatsapp,

    status: "pending",

    emergency: false,

    courier_sent: false,

    call_status: "not_called",

    created_at: now,

    updated_at: now
  };


  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .insert(orderData)
      .select()
      .single();


  if (error) {
    throw error;
  }

  return data;
}


/* =========================
   LOAD ALL ORDERS
========================= */

async function loadAllOrders() {

  if (!dbClient) {

    const connected = initDatabase();

    if (!connected) {
      return [];
    }
  }

  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {
    console.error(
      "Order load error:",
      error
    );

    throw error;
  }

  return data || [];
}


/* =========================
   LOAD PENDING ORDERS
========================= */

async function loadPendingOrders() {

  if (!dbClient) {

    const connected = initDatabase();

    if (!connected) {
      return [];
    }
  }

  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .select("*")
      .eq(
        "status",
        "pending"
      )
      .eq(
        "emergency",
        false
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {
    throw error;
  }

  return data || [];
}


/* =========================
   EMERGENCY
========================= */

async function moveOrderToEmergency(orderId) {

  if (!dbClient) {
    initDatabase();
  }

  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .update({
        emergency: true,
        updated_at: new Date().toISOString()
      })
      .eq(
        "id",
        orderId
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================
   CALL STATUS
========================= */

async function updateCallStatus(
  orderId,
  status
) {

  if (!dbClient) {
    initDatabase();
  }

  const now =
    new Date().toISOString();

  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .update({

        call_status: status,

        call_updated_at: now,

        updated_at: now

      })
      .eq(
        "id",
        orderId
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================
   EDIT ORDER
========================= */

async function updateOrder(
  orderId,
  changes
) {

  if (!dbClient) {
    initDatabase();
  }

  const safeChanges = {
    ...changes,

    updated_at:
      new Date().toISOString()
  };

  const { data, error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .update(safeChanges)
      .eq(
        "id",
        orderId
      )
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================
   DELETE ORDER
========================= */

async function deleteOrderFromDatabase(
  orderId
) {

  if (!dbClient) {
    initDatabase();
  }

  const { error } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .delete()
      .eq(
        "id",
        orderId
      );

  if (error) {
    throw error;
  }

  return true;
}


/* =========================
   REALTIME
========================= */

function startOrderRealtime(
  callback
) {

  if (!dbClient) {

    const connected =
      initDatabase();

    if (!connected) {
      return null;
    }
  }


  if (realtimeChannel) {

    dbClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }


  realtimeChannel =
    dbClient
      .channel(
        "order-management-realtime"
      )

      .on(
        "postgres_changes",

        {
          event: "*",
          schema: "public",
          table: DB_CONFIG.ordersTable
        },

        payload => {

          console.log(
            "Realtime order change:",
            payload
          );

          if (
            typeof callback ===
            "function"
          ) {
            callback(payload);
          }
        }
      )

      .subscribe();


  return realtimeChannel;
}


/* =========================
   STOP REALTIME
========================= */

function stopOrderRealtime() {

  if (
    dbClient &&
    realtimeChannel
  ) {

    dbClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }
}


/* =========================
   EXPORT FUNCTIONS
========================= */

window.OrderDatabase = {

  init:
    initDatabase,

  save:
    saveOrderToDatabase,

  loadAll:
    loadAllOrders,

  loadPending:
    loadPendingOrders,

  emergency:
    moveOrderToEmergency,

  updateCall:
    updateCallStatus,

  update:
    updateOrder,

  delete:
    deleteOrderFromDatabase,

  realtime:
    startOrderRealtime,

  stopRealtime:
    stopOrderRealtime
};


/* AUTO START */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    initDatabase();

  }
);
