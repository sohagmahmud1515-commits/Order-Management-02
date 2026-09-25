/* =========================================================
   ORDER MANAGEMENT 02
   DATABASE MODULE — FINAL
   Single Order Text Box + Image + Supabase + Realtime
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
   DATABASE INIT
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

    console.log("Database connected.");
    return true;

  } catch (error) {

    console.error(error);
    return false;
  }
}


/* =========================
   UNIQUE ID
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
    Math.random().toString(36).slice(2)
  );
}


/* =========================
   FIND PHONE FROM FULL TEXT
========================= */

function extractPhone(text) {

  /*
    English digit only:
    01XXXXXXXXX
  */

  const match =
    String(text || "").match(/(?:^|[^\d])(01\d{9})(?!\d)/);

  return match ? match[1] : "";
}


/* =========================
   CHECK CUSTOMER NAME
========================= */

function hasCustomerName(text) {

  const value = String(text || "").trim();

  if (!value) return false;

  /*
    নাম:, নাম-, Name:, Customer Name:
  */

  const labelledName =
    /(?:নাম|name|customer\s*name)\s*[:：\-]?\s*([A-Za-z\u0980-\u09FF][A-Za-z\u0980-\u09FF .'-]{1,})/i;

  if (labelledName.test(value)) {
    return true;
  }

  /*
    প্রথম non-empty line-এ বাংলা/English নাম থাকলেও গ্রহণ করবে।
  */

  const lines =
    value
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);

  if (!lines.length) return false;

  const firstLine =
    lines[0]
      .replace(/^(নাম|name|customer\s*name)\s*[:：\-]?\s*/i, "")
      .trim();

  return /^[A-Za-z\u0980-\u09FF][A-Za-z\u0980-\u09FF .'-]{1,}$/i
    .test(firstLine);
}


/* =========================
   VALIDATE FULL ORDER
========================= */

function validateFullOrder(orderText) {

  const text =
    String(orderText || "").trim();

  const problems = [];

  if (!text) {

    problems.push(
      "কাস্টমারের সম্পূর্ণ অর্ডার দেওয়া হয়নি।"
    );

    return {
      valid: false,
      phone: "",
      problems
    };
  }

  if (!hasCustomerName(text)) {

    problems.push(
      "কাস্টমারের নাম পাওয়া যায়নি। নাম বাংলা অথবা English-এ লিখুন।"
    );
  }

  const phone =
    extractPhone(text);

  if (!phone) {

    problems.push(
      "সঠিক ১১ সংখ্যার English মোবাইল নাম্বার পাওয়া যায়নি। উদাহরণ: 01712345678"
    );
  }

  return {
    valid: problems.length === 0,
    phone,
    problems
  };
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

    if (
      file.name &&
      file.name.includes(".")
    ) {

      extension =
        file.name
          .split(".")
          .pop()
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase() || "jpg";
    }

    const filePath =
      orderId +
      "/" +
      Date.now() +
      "-" +
      i +
      "-" +
      Math.random().toString(36).slice(2, 8) +
      "." +
      extension;

    const {
      error: uploadError
    } =
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

      console.error(
        "Image upload error:",
        uploadError
      );

      throw new Error(
        "ছবি Upload হয়নি: " +
        uploadError.message
      );
    }

    const {
      data
    } =
      dbClient.storage
        .from(DB_CONFIG.storageBucket)
        .getPublicUrl(filePath);

    if (
      !data ||
      !data.publicUrl
    ) {

      throw new Error(
        "ছবির URL পাওয়া যায়নি।"
      );
    }

    urls.push(
      data.publicUrl
    );
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
  orderText,
  customerText,
  phone,
  images,
  submittedBy = "Admin",
  moderatorWhatsapp = ""
}) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  /*
    পুরোনো orders.html orderText পাঠালেও চলবে।
    নতুন code customerText পাঠালেও চলবে।
  */

  const fullText =
    String(
      customerText ||
      orderText ||
      ""
    ).trim();

  const validation =
    validateFullOrder(fullText);

  /*
    যদি আলাদা phone field থেকে phone আসে,
    সেটাও গ্রহণ করবে।
  */

  let detectedPhone =
    String(phone || "").trim();

  if (!/^01\d{9}$/.test(detectedPhone)) {
    detectedPhone = validation.phone;
  }

  const problems = [];

  if (!page || !String(page).trim()) {
    problems.push("পেজ সিলেক্ট করুন।");
  }

  if (!fullText) {
    problems.push(
      "কাস্টমারের সম্পূর্ণ অর্ডার দেওয়া হয়নি।"
    );
  } else {

    if (!hasCustomerName(fullText)) {
      problems.push(
        "কাস্টমারের নাম পাওয়া যায়নি। নাম বাংলা অথবা English-এ লিখুন।"
      );
    }

    if (!/^01\d{9}$/.test(detectedPhone)) {
      problems.push(
        "সঠিক ১১ সংখ্যার English মোবাইল নাম্বার পাওয়া যায়নি। উদাহরণ: 01712345678"
      );
    }
  }

  if (!images || images.length < 1) {
    problems.push("অন্তত ১টি ছবি দিন।");
  }

  if (images && images.length > 7) {
    problems.push("সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।");
  }

  if (problems.length) {

    throw new Error(
      "অর্ডার সাবমিট হয়নি।\n\n" +
      problems
        .map(item => "• " + item)
        .join("\n")
    );
  }


  const orderId =
    createOrderId();

  const imageUrls =
    await uploadOrderImages(
      images,
      orderId
    );

  const now =
    new Date().toISOString();


  /*
    Supabase-এর বর্তমান column:
    customer_text
    phone
    images
  */

  const orderData = {

    id: orderId,

    page_name:
      String(page).trim(),

    customer_text:
      fullText,

    phone:
      detectedPhone,

    images:
      imageUrls,

    submitted_by:
      submittedBy || "Admin",

    moderator_whatsapp:
      moderatorWhatsapp || "",

    status:
      "pending",

    emergency:
      false,

    courier_sent:
      false,

    call_status:
      "not_called",

    created_at:
      now,

    updated_at:
      now
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

    console.error(
      "Order save error:",
      error
    );

    throw new Error(
      "অর্ডার Save হয়নি: " +
      error.message
    );
  }

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
        {
          ascending: false
        }
      );

  if (error) {
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
        updated_at:
          new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();

  if (error) {
    throw error;
  }

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
        updated_at:
          new Date().toISOString()
      })
      .eq("id", orderId)
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

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const now =
    new Date().toISOString();

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

  if (error) {
    throw error;
  }

  return data;
}


/* =========================
   UPDATE
========================= */

async function updateOrder(
  orderId,
  changes
) {

  if (!dbClient && !initDatabase()) {
    throw new Error("Database connect হয়নি।");
  }

  const safeChanges = {
    ...changes,
    updated_at:
      new Date().toISOString()
  };

  /*
    পুরোনো field নাম এলে
    নতুন database field-এ convert করবে।
  */

  if ("order_text" in safeChanges) {

    safeChanges.customer_text =
      safeChanges.order_text;

    delete safeChanges.order_text;
  }

  if ("image_urls" in safeChanges) {

    safeChanges.images =
      safeChanges.image_urls;

    delete safeChanges.image_urls;
  }

  const {
    data,
    error
  } =
    await dbClient
      .from(DB_CONFIG.ordersTable)
      .update(safeChanges)
      .eq("id", orderId)
      .select()
      .single();

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

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
            "Realtime:",
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
   EXPORT
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

    initDatabase();

  }
);
