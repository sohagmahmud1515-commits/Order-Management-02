/* =========================================================
   ORDER MANAGEMENT 02
   DATABASE MODULE
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
   START DATABASE
========================= */

function initDatabase() {

  if (
    !DB_CONFIG.supabaseUrl ||
    !DB_CONFIG.supabaseAnonKey
  ) {
    console.error("Supabase URL অথবা Key পাওয়া যায়নি।");
    return false;
  }

  if (!window.supabase) {
    console.error("Supabase library পাওয়া যায়নি।");
    return false;
  }

  if (dbClient) {
    return true;
  }

  try {

    dbClient = window.supabase.createClient(
      DB_CONFIG.supabaseUrl,
      DB_CONFIG.supabaseAnonKey
    );

    console.log("Supabase Database connected.");

    return true;

  } catch (error) {

    console.error(
      "Database connection error:",
      error
    );

    return false;
  }
}


/* =========================
   CREATE UNIQUE ORDER ID
========================= */

function createOrderId() {

  if (
    window.crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
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

async function uploadOrderImages(
  files,
  orderId
) {

  if (!dbClient) {

    const connected = initDatabase();

    if (!connected) {
      throw new Error(
        "Supabase Database connect হয়নি।"
      );
    }
  }

  if (!files || files.length === 0) {
    throw new Error(
      "অন্তত ১টি ছবি দিন।"
    );
  }

  if (files.length > 7) {
    throw new Error(
      "সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।"
    );
  }

  const urls = [];

  for (
    let i = 0;
    i < files.length;
    i++
  ) {

    const file = files[i];

    if (!file) {
      continue;
    }

    let extension = "jpg";

    if (file.name && file.name.includes(".")) {

      extension =
        file.name
          .split(".")
          .pop()
          .replace(
            /[^a-zA-Z0-9]/g,
            ""
          )
          .toLowerCase() || "jpg";
    }

    const uniquePart =
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 8);

    const filePath =
      `${orderId}/${uniquePart}-${i}.${extension}`;


    const {
      error: uploadError
    } =
      await dbClient
        .storage
        .from(
          DB_CONFIG.storageBucket
        )
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              file.type || undefined
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
      data: publicData
    } =
      dbClient
        .storage
        .from(
          DB_CONFIG.storageBucket
        )
        .getPublicUrl(
          filePath
        );


    if (
      publicData &&
      publicData.publicUrl
    ) {

      urls.push(
        publicData.publicUrl
      );

    } else {

      throw new Error(
        "ছবির Public URL পাওয়া যায়নি।"
      );
    }
  }


  if (urls.length === 0) {

    throw new Error(
      "কোনো ছবি Upload হয়নি।"
    );
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

    const connected =
      initDatabase();

    if (!connected) {

      throw new Error(
        "Supabase connection তৈরি হয়নি।"
      );
    }
  }


  if (!page || !page.trim()) {

    throw new Error(
      "পেজ সিলেক্ট করুন।"
    );
  }


  if (
    !orderText ||
    !orderText.trim()
  ) {

    throw new Error(
      "অর্ডারের তথ্য দিন।"
    );
  }


  if (
    !images ||
    images.length < 1
  ) {

    throw new Error(
      "অন্তত ১টি ছবি দিন।"
    );
  }


  if (images.length > 7) {

    throw new Error(
      "সর্বোচ্চ ৭টি ছবি দেওয়া যাবে।"
    );
  }


  const orderId =
    createOrderId();


  /* FIRST UPLOAD IMAGES */

  const imageUrls =
    await uploadOrderImages(
      images,
      orderId
    );


  const now =
    new Date().toISOString();


  const orderData = {

    id: orderId,

    page_name:
      page.trim(),

    order_text:
      orderText.trim(),

    image_urls:
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
      .from(
        DB_CONFIG.ordersTable
      )
      .insert(
        orderData
      )
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


  console.log(
    "Order successfully saved:",
    data
  );

  return data;
}


/* =========================
   LOAD ALL ORDERS
========================= */

async function loadAllOrders() {

  if (!dbClient) {

    const connected =
      initDatabase();

    if (!connected) {
      return [];
    }
  }


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "All Order load error:",
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

    const connected =
      initDatabase();

    if (!connected) {
      return [];
    }
  }


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
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

    console.error(
      "Pending load error:",
      error
    );

    throw error;
  }


  return data || [];
}


/* =========================
   LOAD EMERGENCY ORDERS
========================= */

async function loadEmergencyOrders() {

  if (!dbClient) {

    const connected =
      initDatabase();

    if (!connected) {
      return [];
    }
  }


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .select("*")
      .eq(
        "emergency",
        true
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
   MOVE TO EMERGENCY
========================= */

async function moveOrderToEmergency(
  orderId
) {

  if (!dbClient) {

    const connected =
      initDatabase();

    if (!connected) {
      throw new Error(
        "Database connect হয়নি।"
      );
    }
  }


  const now =
    new Date().toISOString();


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .update({
        emergency: true,
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
   REMOVE FROM EMERGENCY
========================= */

async function removeEmergency(
  orderId
) {

  if (!dbClient) {
    initDatabase();
  }


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .update({
        emergency: false,
        updated_at:
          new Date().toISOString()
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


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .update({

        call_status:
          status,

        call_updated_at:
          now,

        updated_at:
          now

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


  const {
    data,
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
      .update(
        safeChanges
      )
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


  const {
    error
  } =
    await dbClient
      .from(
        DB_CONFIG.ordersTable
      )
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
          table:
            DB_CONFIG.ordersTable
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

            callback(
              payload
            );
          }
        }
      )
      .subscribe(
        status => {

          console.log(
            "Realtime status:",
            status
          );
        }
      );


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
   CONNECTION TEST
========================= */

async function testDatabaseConnection() {

  if (!dbClient) {

    const connected =
      initDatabase();

    if (!connected) {

      return {
        success: false,
        message:
          "Database connect হয়নি।"
      };
    }
  }


  try {

    const {
      error
    } =
      await dbClient
        .from(
          DB_CONFIG.ordersTable
        )
        .select(
          "id",
          {
            head: true,
            count: "exact"
          }
        );


    if (error) {
      throw error;
    }


    return {
      success: true,
      message:
        "Database connection OK"
    };


  } catch (error) {

    console.error(
      "Database test failed:",
      error
    );


    return {
      success: false,
      message:
        error.message
    };
  }
}


/* =========================
   EXPORT FUNCTIONS
========================= */

window.OrderDatabase = {

  init:
    initDatabase,

  test:
    testDatabaseConnection,

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

    const connected =
      initDatabase();

    if (connected) {

      console.log(
        "ORDER MANAGEMENT 02 database module ready."
      );
    }

  }
);
