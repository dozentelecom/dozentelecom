const base = (
  process.env.SME_API_URL ||
  "https://smeapi.com.ng/api"
).replace(/\/+$/, "");

const key = process.env.SME_API_KEY || "";

export class ProviderError extends Error {
  status: number;
  details: any;

  constructor(
    message: string,
    status = 502,
    details?: any
  ) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.details = details;
  }
}

async function request(
  path: string,
  method: "GET" | "POST",
  data?: Record<string, any>
) {
  if (!key) {
    throw new ProviderError(
      "SME_API_KEY is missing from .env",
      500
    );
  }

  const controller = new AbortController();

  const timeout = Number(
    process.env.SME_API_TIMEOUT_MS || 20000
  );

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(
      `${base}${path}`,
      {
        method,

        headers: {
          Authorization: `Token ${key}`,
          Accept: "application/json",

          ...(method === "POST"
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),
        },

        ...(method === "POST"
          ? {
              body: JSON.stringify(
                data || {}
              ),
            }
          : {}),

        cache: "no-store",
        signal: controller.signal,
      }
    );

    const text = await response.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      json = {
        raw: text,
      };
    }

    if (!response.ok) {
      throw new ProviderError(
        json?.message ||
          json?.error ||
          `SME API request failed (${response.status})`,
        response.status,
        json
      );
    }

    return json;
  } catch (e: any) {
    if (e instanceof ProviderError) {
      throw e;
    }

    if (e?.name === "AbortError") {
      throw new ProviderError(
        "SME API request timed out. Please try again.",
        504
      );
    }

    const cause =
      e?.cause?.code ||
      e?.code;

    if (cause === "ENOTFOUND") {
      throw new ProviderError(
        "SME API hostname could not be resolved. Check your internet connection or SME API availability.",
        503
      );
    }

    if (
      cause === "UND_ERR_CONNECT_TIMEOUT" ||
      /timeout/i.test(
        e?.message || ""
      )
    ) {
      throw new ProviderError(
        "Could not connect to SME API. Please try again shortly.",
        504
      );
    }

    throw new ProviderError(
      e?.message ||
        "Unable to connect to SME API",
      502
    );
  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   SME API METHODS
   ========================================================= */

export const smeapi = {
  catalog: () =>
    request(
      "/catalog/",
      "GET"
    ),

  dataPlans: () =>
    request(
      "/dataplans/",
      "GET"
    ),

  data: (data: any) =>
    request(
      "/data/",
      "POST",
      data
    ),

  airtime: (data: any) =>
    request(
      "/airtime/",
      "POST",
      data
    ),

  cableVerify: (data: any) =>
    request(
      "/cabletv/verify/",
      "POST",
      data
    ),

  cable: (data: any) =>
    request(
      "/cabletv/",
      "POST",
      data
    ),

  electricityVerify: (data: any) =>
    request(
      "/electricity/verify/",
      "POST",
      data
    ),

  electricity: (data: any) =>
    request(
      "/electricity/",
      "POST",
      data
    ),

  exam: (data: any) =>
    request(
      "/exam/",
      "POST",
      data
    ),

  dataPin: (data: any) =>
    request(
      "/datapin/",
      "POST",
      data
    ),

  rechargePin: (data: any) =>
    request(
      "/rechargepin/",
      "POST",
      data
    ),

  bulkSms: (data: any) =>
    request(
      "/bulksms/",
      "POST",
      data
    ),

  smile: (data: any) =>
    request(
      "/smile-data/",
      "POST",
      data
    ),

  status: (data: any) =>
    request(
      "/status/",
      "POST",
      data
    ),

  user: () =>
    request(
      "/user/",
      "GET"
    ),
};


/* =========================================================
   GENERIC ARRAY HELPER
   ========================================================= */

export function arrays(
  payload: any,
  keys: string[]
) {
  for (const key of keys) {
    const value = key
      .split(".")
      .reduce(
        (current: any, part: string) =>
          current?.[part],
        payload
      );

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}


/* =========================================================
   ID HELPER
   ========================================================= */

export function idOf(x: any) {
  return (
    x?.id ??
    x?.provider_id ??
    x?.providerId ??
    x?.electricity_provider_id ??
    x?.electricityProviderId ??
    x?.disco_id ??
    x?.discoId ??
    x?.cable_provider_id ??
    x?.cableProviderId ??
    x?.cable_id ??
    x?.exam_provider_id ??
    x?.examProviderId ??
    x?.exam_id ??
    x?.network_id ??
    x?.plan_id ??
    x?.service_id ??
    x?.code ??
    ""
  );
}


/* =========================================================
   NAME HELPER
   ========================================================= */

export function nameOf(x: any) {
  return String(
    x?.name ??
      x?.provider_name ??
      x?.providerName ??
      x?.electricity_name ??
      x?.electricity_provider_name ??
      x?.disco_name ??
      x?.disco ??
      x?.cable_name ??
      x?.cable_provider ??
      x?.cable_provider_name ??
      x?.cableProvider ??
      x?.exam_name ??
      x?.exam_provider ??
      x?.exam_provider_name ??
      x?.education_name ??
      x?.education_provider ??
      x?.plan_name ??
      x?.network_name ??
      x?.network ??
      x?.title ??
      x?.label ??
      ""
  ).trim();
}


/* =========================================================
   FIND ARRAY BY MANY POSSIBLE KEYS
   ========================================================= */

function findArray(
  payload: any,
  keys: string[]
): any[] {
  const result = arrays(
    payload,
    keys
  );

  if (result.length) {
    return result;
  }

  return [];
}


/* =========================================================
   UNIQUE ITEMS
   ========================================================= */

function uniqueItems(
  items: any[]
) {
  const map =
    new Map<string, any>();

  for (const item of items) {
    const itemId = String(
      idOf(item)
    );

    const itemName =
      nameOf(item)
        .toLowerCase();

    const key =
      `${itemId}:${itemName}`;

    if (
      itemId ||
      itemName
    ) {
      if (!map.has(key)) {
        map.set(
          key,
          item
        );
      }
    }
  }

  return Array.from(
    map.values()
  );
}


/* =========================================================
   CATALOG NORMALIZER
   ========================================================= */

export function normalizeCatalog(
  payload: any
) {
  /*
   * SME can return the catalog wrapped
   * in different structures.
   *
   * We intentionally check all common
   * structures rather than assuming only
   * one response shape.
   */

  const root =
    payload?.data ??
    payload?.catalog ??
    payload;

  /* -----------------------------------------
     ELECTRICITY
     ----------------------------------------- */

  let electricityProviders =
    findArray(
      payload,
      [
        "electricityProviders",
        "electricity_providers",
        "electricity",
        "data.electricity",
        "data.electricityProviders",
        "data.electricity_providers",
        "catalog.electricity",
        "catalog.electricityProviders",
        "catalog.electricity_providers",
        "providers.electricity",
        "services.electricity",
        "discos",
        "data.discos",
        "providers.discos",
      ]
    );

  /* -----------------------------------------
     CABLE
     ----------------------------------------- */

  let cableProviders =
    findArray(
      payload,
      [
        "cableProviders",
        "cable_providers",
        "cable",
        "cabletv",
        "cable_tv",
        "cabletvProviders",
        "cable_tv_providers",
        "data.cable",
        "data.cabletv",
        "data.cable_tv",
        "data.cableProviders",
        "data.cable_providers",
        "catalog.cable",
        "catalog.cabletv",
        "catalog.cable_tv",
        "catalog.cableProviders",
        "providers.cable",
        "providers.cabletv",
        "providers.cable_tv",
        "services.cable",
        "services.cabletv",
      ]
    );

  /* -----------------------------------------
     EDUCATION / EXAM
     ----------------------------------------- */

  let examProviders =
    findArray(
      payload,
      [
        "examProviders",
        "exam_providers",
        "education",
        "educationProviders",
        "education_providers",
        "exams",
        "exam",
        "data.examProviders",
        "data.exam_providers",
        "data.education",
        "data.educationProviders",
        "data.education_providers",
        "data.exams",
        "data.exam",
        "catalog.examProviders",
        "catalog.exam_providers",
        "catalog.education",
        "catalog.educationProviders",
        "catalog.education_providers",
        "catalog.exams",
        "providers.education",
        "providers.exams",
        "services.education",
      ]
    );


  /*
   * Sometimes SME returns everything
   * inside a generic `providers` array.
   */

  const genericProviders =
    findArray(
      payload,
      [
        "providers",
        "data.providers",
        "catalog.providers",
        "services",
        "data.services",
      ]
    );


  /* =====================================================
     CLASSIFY GENERIC PROVIDERS
     ===================================================== */

  if (
    genericProviders.length
  ) {
    for (
      const provider of genericProviders
    ) {
      const text = JSON.stringify(
        provider
      ).toLowerCase();

      const providerName =
        nameOf(provider)
          .toLowerCase();

      const combined =
        `${providerName} ${text}`;

      /*
       * Electricity
       */

      if (
        combined.includes(
          "electric"
        ) ||
        combined.includes(
          "disco"
        ) ||
        combined.includes(
          "power"
        ) ||
        combined.includes(
          "utility"
        )
      ) {
        electricityProviders.push(
          provider
        );

        continue;
      }

      /*
       * Cable TV
       */

      if (
        combined.includes(
          "cable"
        ) ||
        combined.includes(
          "dstv"
        ) ||
        combined.includes(
          "gotv"
        ) ||
        combined.includes(
          "startimes"
        ) ||
        combined.includes(
          "tv"
        )
      ) {
        cableProviders.push(
          provider
        );

        continue;
      }

      /*
       * Education / Exam
       */

      if (
        combined.includes(
          "exam"
        ) ||
        combined.includes(
          "education"
        ) ||
        combined.includes(
          "waec"
        ) ||
        combined.includes(
          "neco"
        ) ||
        combined.includes(
          "jamb"
        ) ||
        combined.includes(
          "nabteb"
        )
      ) {
        examProviders.push(
          provider
        );
      }
    }
  }


  /* =====================================================
     NORMALIZE PROVIDER OBJECTS
     ===================================================== */

  function normalizeProvider(
    provider: any
  ) {
    const providerId =
      String(
        idOf(provider)
      );

    const providerName =
      nameOf(provider);

    const plans =
      findArray(
        provider,
        [
          "plans",
          "packages",
          "variations",
          "bouquets",
          "products",
          "subscriptions",
          "bundles",
          "items",
          "data",
        ]
      );

    return {
      ...provider,

      id:
        providerId,

      provider_id:
        providerId,

      name:
        providerName,

      plans:
        plans || [],
    };
  }


  electricityProviders =
    uniqueItems(
      electricityProviders
        .map(
          normalizeProvider
        )
        .filter(
          (item: any) =>
            idOf(item) &&
            nameOf(item)
        )
    );


  cableProviders =
    uniqueItems(
      cableProviders
        .map(
          normalizeProvider
        )
        .filter(
          (item: any) =>
            idOf(item) &&
            nameOf(item)
        )
    );


  examProviders =
    uniqueItems(
      examProviders
        .map(
          normalizeProvider
        )
        .filter(
          (item: any) =>
            idOf(item) &&
            nameOf(item)
        )
    );


  /* =====================================================
     DEBUG INFORMATION
     ===================================================== */

  console.log(
    "================================="
  );

  console.log(
    "SME CATALOG NORMALIZED"
  );

  console.log(
    "ELECTRICITY PROVIDERS:",
    electricityProviders.length
  );

  console.log(
    "CABLE PROVIDERS:",
    cableProviders.length
  );

  console.log(
    "EXAM PROVIDERS:",
    examProviders.length
  );

  console.log(
    "================================="
  );


  return {
    electricityProviders,
    cableProviders,
    examProviders,

    /*
     * Keep these aliases so existing
     * dashboard code does not break.
     */

    electricity:
      electricityProviders,

    cable:
      cableProviders,

    education:
      examProviders,

    exams:
      examProviders,

    raw:
      payload,

    root,
  };
}