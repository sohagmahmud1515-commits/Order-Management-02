/* =========================================================
   ORDER MANAGEMENT 02
   DATABASE MODULE — FINAL
   Supabase + Storage + Realtime
========================================================= */

const DB_CONFIG = {
  supabaseUrl: "https://wcjzugrizxdxafyzexrr.supabase.co",
  supabaseAnonKey: "sb_publishable_ZpSiNbSCaGVuYKs8rZ8BKw_2PpZrxRP",

  ordersTable: "orders",
  storageBucket: "order-images"
};

let dbClient = null;
let realtimeChannel = null;


/* =========================
   INITIALIZE DATABASE
========================= */

function initDatabase() {

  if (!window.supabase) {
    console.error("Supabase library পাওয়া যায়নি।");
    return false;
  }

  if (dbClient) return true;

  try {

    dbClient = window.supabase.createClient(
      DB_CONFIG.supabaseUrl,
      DB_CONFIG.supabaseAnonKey
    );

    console.log("Supabase connected.");
    return true;

  } catch (error) {

    console.error("Supabase connection error:", error);
    return false;
  }
}


/* =========================
   CREATE UNIQUE ID
========================= */

function createOrderId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2) +
    "-" +
    Math.random().toString(36).slice(2)
  );
}


/* =========================
   IMAGE UPLOAD
========================= */

async function uploadOrderImages(files, orderId) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  if (!files || files.length < 1) {
    throw new Error("অন্তত ১টি ছবি দিন।");
  }

  if (files.length > 7) {
    throw new Error("সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।");
  }

  const urls = [];

  for (let i = 0; i < files.length; i++) {

    const file = files[i];

    if (!file) continue;

    if (
      file.type &&
      !file.type.startsWith("image/")
    ) {
      throw new Error("শুধু ছবির ফাইল দেওয়া যাবে।");
    }

    let extension = "jpg";

    if (file.name && file.name.includes(".")) {

      extension =
        file.name
          .split(".")
          .pop()
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase() || "jpg";
    }

    const uniquePart =
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 10);

    const filePath =
      `${orderId}/${uniquePart}-${i}.${extension}`;

    const { error: uploadError } =
      await dbClient
        .storage
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

      console.error("Image upload error:", uploadError);

      throw new Error(
        "ছবি Upload হয়নি: " +
        uploadError.message
      );
    }

    const { data } =
      dbClient
        .storage
        .from(DB_CONFIG.storageBucket)
        .getPublicUrl(filePath);

    if (!data || !data.publicUrl) {
      throw new Error("ছবির URL পাওয়া যায়নি।");
    }

    urls.push(data.publicUrl);
  }

  if (!urls.length) {
    throw new Error("কোনো ছবি Upload হয়নি।");
  }

  return urls;
}


/* =========================
   SAVE ORDER
========================= */

async function saveOrderToDatabase({
  page,
  customerText,
  phone,
  images,
  submittedBy = "Admin",
  moderatorWhatsapp = ""
}) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  page = String(page || "").trim();
  customerText = String(customerText || "").trim();
  phone = String(phone || "").trim();

  if (!page) {
    throw new Error("পেজ সিলেক্ট করুন।");
  }

  if (!customerText) {
    throw new Error("কাস্টমারের অর্ডারের তথ্য দিন।");
  }

  /*
    Bangladesh mobile:
    English digits only
    01XXXXXXXXX = 11 digits
  */

  if (!/^01\d{9}$/.test(phone)) {
    throw new Error(
      "সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন। উদাহরণ: 01712345678"
    );
  }

  if (!images || images.length < 1) {
    throw new Error("অন্তত ১টি ছবি দিন।");
  }

  if (images.length > 7) {
    throw new Error("সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।");
  }

  const orderId = createOrderId();

  /*
    প্রথমে ছবি Storage-এ যাবে।
  */

  const imageUrls =
    await uploadOrderImages(
      images,
      orderId
    );

  const now = new Date().toISOString();

  /*
    এই field-গুলো এখন Supabase table-এর
    column-এর সাথে সরাসরি মিলছে।
  */

  const orderData = {

    id: orderId,

    page_name: page,

    customer_text: customerText,

    phone: phone,

    images: imageUrls,

    submitted_by:
      submittedBy || "Admin",

    moderator_whatsapp:
      moderatorWhatsapp || "",

    status: "pending",

    emergency: false,

    courier_sent: false,

    call_status: "not_called",

    created_at: now,

    updated_at: now
  };

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .insert(orderData)
      .select()
      .single();

  if (error) {

    console.error("Order save error:", error);

    throw new Error(
      "অর্ডার Save হয়নি: " +
      error.message
    );
  }

  console.log("Order saved:", data);

  return data;
}


/* =========================
   LOAD ALL
========================= */

async function loadAllOrders() {

  if (!dbClient && !initDatabase()) {
    return [];
  }

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .select("*")
      .order(
        "created_at",
        { ascending: false }
      );

  if (error) {
    console.error("Load All error:", error);
    throw error;
  }

  return data || [];
}


/* =========================
   LOAD PENDING
========================= */

async function loadPendingOrders() {

  if (!dbClient && !initDatabase()) {
    return [];
  }

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .select("*")
      .eq("status", "pending")
      .eq("emergency", false)
      .order(
        "created_at",
        { ascending: true }
      );

  if (error) {
    console.error("Pending load error:", error);
    throw error;
  }

  return data || [];
}


/* =========================
   LOAD EMERGENCY
========================= */

async function loadEmergencyOrders() {

  if (!dbClient && !initDatabase()) {
    return [];
  }

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .select("*")
      .eq("emergency", true)
      .order(
        "created_at",
        { ascending: true }
      );

  if (error) throw error;

  return data || [];
}


/* =========================
   EMERGENCY
========================= */

async function moveOrderToEmergency(orderId) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const {
    data,
    error
  } =
    await dbClient
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


/* =========================
   REMOVE EMERGENCY
========================= */

async function removeEmergency(orderId) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const {
    data,
    error
  } =
    await dbClient
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


/* =========================
   CALL STATUS
========================= */

async function updateCallStatus(
  orderId,
  status
) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const now = new Date().toISOString();

  const {
    data,
    error
  } =
    await dbClient
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


/* =========================
   UPDATE ORDER
========================= */

async function updateOrder(
  orderId,
  changes
) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const allowed = {};

  if ("page_name" in changes)
    allowed.page_name = changes.page_name;

  if ("customer_text" in changes)
    allowed.customer_text = changes.customer_text;

  if ("phone" in changes)
    allowed.phone = changes.phone;

  if ("images" in changes)
    allowed.images = changes.images;

  if ("status" in changes)
    allowed.status = changes.status;

  if ("emergency" in changes)
    allowed.emergency = changes.emergency;

  if ("courier_sent" in changes)
    allowed.courier_sent = changes.courier_sent;

  if ("call_status" in changes)
    allowed.call_status = changes.call_status;

  allowed.updated_at =
    new Date().toISOString();

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .update(allowed)
      .eq("id", orderId)
      .select()
      .single();

  if (error) throw error;

  return data;
}


/* =========================
   DELETE
========================= */

async function deleteOrderFromDatabase(
  orderId
) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const {
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .delete()
      .eq("id", orderId);

  if (error) throw error;

  return true;
}


/* =========================
   REALTIME
========================= */

function startOrderRealtime(callback) {

  if (!dbClient && !initDatabase()) {
    return null;
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
        "order-management-orders-realtime"
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
            "Realtime change:",
            payload
          );

          if (
            typeof callback === "function"
          ) {
            callback(payload);
          }
        }
      )
      .subscribe(status => {

        console.log(
          "Realtime status:",
          status
        );
      });

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
   TEST
========================= */

async function testDatabaseConnection() {

  if (!dbClient && !initDatabase()) {

    return {
      success: false,
      message: "Database connect হয়নি।"
    };
  }

  try {

    const {
      error
    } =
      await dbClient
        .from(DB_CONFIG.ordersTable)
        .select(
          "id",
          {
            head: true,
            count: "exact"
          }
        );

    if (error) throw error;

    return {
      success: true,
      message: "Database connection OK"
    };

  } catch (error) {

    return {
      success: false,
      message:
        error.message || "Unknown error"
    };
  }
}


/* =========================
   EXPORT
========================= */

window.OrderDatabase = {

  init: initDatabase,

  test: testDatabaseConnection,

  uploadImages:
    uploadOrderImages,

  save:
    saveOrderToDatabase,

  loadAll:
    loadAllOrders,

  loadPending:
    loadPendingOrders,

  loadEmergency:
    loadEmergencyOrders,

  emergency:
    moveOrderToEmergency,

  removeEmergency:
    removeEmergency,

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


/* =========================
   AUTO START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (initDatabase()) {

      console.log(
        "ORDER MANAGEMENT 02 DATABASE READY"
      );
    }
  }
);
