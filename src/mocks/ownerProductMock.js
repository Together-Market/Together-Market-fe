
import { mockGetCurrentUser } from "./authMock";
import { mockGetOwnerStores } from "./ownerMock";

const PRODUCTS_KEY = "together-market-owner-products";

const wait = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function readProducts() {
  try {
    const data = JSON.parse(
      sessionStorage.getItem(PRODUCTS_KEY) || "{}"
    );

    return data && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch {
    return {};
  }
}

function saveProducts(data) {
  sessionStorage.setItem(
    PRODUCTS_KEY,
    JSON.stringify(data)
  );
}

function clone(value) {
  return structuredClone(value);
}

function makeError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.errors = [];
  return error;
}

async function requireStore(storeId) {
  const user = await mockGetCurrentUser();

  if (!user || user.role !== "OWNER") {
    throw makeError(
      "ACCESS_DENIED",
      "사장님 계정으로 로그인해 주세요.",
      403
    );
  }

  const stores = await mockGetOwnerStores();
  const store = stores.items.find(
    (item) => String(item.id) === String(storeId)
  );

  if (!store) {
    throw makeError(
      "RESOURCE_NOT_FOUND",
      "관리할 수 있는 점포가 없습니다.",
      404
    );
  }

  return store;
}

function validateProduct(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "상품 정보가 올바르지 않습니다."
    );
  }

  if (
    typeof payload.name !== "string" ||
    !payload.name.trim()
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "상품명을 입력해 주세요."
    );
  }

  const price = Number(payload.price_amount);
  const preparationMinutes = Number(
    payload.preparation_minutes
  );

  if (
    !Number.isSafeInteger(price) ||
    price <= 0
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "상품 가격은 1원 이상의 정수여야 합니다."
    );
  }

  if (
    !Number.isSafeInteger(preparationMinutes) ||
    preparationMinutes < 0
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "상품 준비시간은 0 이상의 정수여야 합니다."
    );
  }

  if (
    payload.image_url &&
    !/^https?:\/\/.+/i.test(payload.image_url)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "이미지는 http 또는 https 주소를 입력해 주세요."
    );
  }

  if (
    !Array.isArray(payload.purpose_category_ids) ||
    payload.purpose_category_ids.length === 0
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "구매 목적 태그를 하나 이상 선택해 주세요."
    );
  }
}

function findProduct(data, storeId, productId) {
  const items = data[String(storeId)] ?? [];

  const index = items.findIndex(
    (item) => String(item.id) === String(productId)
  );

  if (index === -1) {
    throw makeError(
      "RESOURCE_NOT_FOUND",
      "상품을 찾을 수 없습니다.",
      404
    );
  }

  return { items, index, product: items[index] };
}

// OWN-06: 상품 목록
export async function mockGetOwnerProducts(storeId) {
  await wait();
  await requireStore(storeId);

  const data = readProducts();

  return {
    items: clone(data[String(storeId)] ?? []),
  };
}

// OWN-07: 상품 등록
export async function mockCreateOwnerProduct(
  storeId,
  payload
) {
  await wait(400);
  await requireStore(storeId);
  validateProduct(payload);

  const data = readProducts();
  const key = String(storeId);
  const now = new Date().toISOString();

  const product = {
    id: crypto.randomUUID(),
    store_id: key,
    name: payload.name.trim(),
    description: String(
      payload.description ?? ""
    ).trim(),
    price_amount: Number(payload.price_amount),
    preparation_minutes: Number(
      payload.preparation_minutes
    ),
    image_url: payload.image_url?.trim() || null,
    purpose_category_ids:
      payload.purpose_category_ids.map(String),
    sale_status: "ON_SALE",
    created_at: now,
    updated_at: now,
  };

  data[key] = [...(data[key] ?? []), product];
  saveProducts(data);

  return clone(product);
}

// OWN-08: 상품 정보 수정
export async function mockUpdateOwnerProduct(
  storeId,
  productId,
  payload
) {
  await wait(350);
  await requireStore(storeId);
  validateProduct(payload);

  const data = readProducts();
  const { items, index, product } = findProduct(
    data,
    storeId,
    productId
  );

  const updated = {
    ...product,
    name: payload.name.trim(),
    description: String(
      payload.description ?? ""
    ).trim(),
    price_amount: Number(payload.price_amount),
    preparation_minutes: Number(
      payload.preparation_minutes
    ),
    image_url: payload.image_url?.trim() || null,
    purpose_category_ids:
      payload.purpose_category_ids.map(String),
    updated_at: new Date().toISOString(),
  };

  items[index] = updated;
  data[String(storeId)] = items;
  saveProducts(data);

  return clone(updated);
}

// OWN-09: 판매 상태 변경
export async function mockUpdateOwnerProductSaleStatus(
  storeId,
  productId,
  saleStatus
) {
  await wait(300);
  await requireStore(storeId);

  if (
    !["ON_SALE", "SOLD_OUT", "PAUSED"].includes(
      saleStatus
    )
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "판매 상태가 올바르지 않습니다."
    );
  }

  const data = readProducts();
  const { items, index, product } = findProduct(
    data,
    storeId,
    productId
  );

  const updated = {
    ...product,
    sale_status: saleStatus,
    updated_at: new Date().toISOString(),
  };

  items[index] = updated;
  data[String(storeId)] = items;
  saveProducts(data);

  return clone(updated);
}
