
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  AlertCircle,
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  LogOut,
  Package,
  RefreshCw,
  Store,
} from "lucide-react";

import { getOwnerStores } from "../../api/ownerApi";
import { getPurposeCategories } from "../../api/purposeApi";

import {
  getOwnerProducts,
  createOwnerProduct,
  updateOwnerProduct,
  updateOwnerProductSaleStatus,
} from "../../api/ownerProductApi";

import { logout } from "../../api/authApi";

import "./OwnerProductPage.css";

// ==========================================
// 기본 상품 데이터
// ==========================================

const EMPTY_PRODUCT = {
  name: "",
  price_amount: "",
  description: "",
  preparation_minutes: "",
  image_url: "",
  purpose_category_ids: [],
};

// ==========================================
// 판매 상태
// ==========================================

const SALE_STATUSES = [
  {
    value: "ON_SALE",
    label: "판매 중",
    description: "고객이 구매할 수 있는 상태예요.",
  },
  {
    value: "SOLD_OUT",
    label: "품절",
    description: "재고가 모두 소진된 상태예요.",
  },
  {
    value: "PAUSED",
    label: "판매 중지",
    description: "상품 판매를 일시적으로 중단해요.",
  },
];

function getStatusLabel(status) {
  return (
    SALE_STATUSES.find(
      (item) => item.value === status
    )?.label ?? "상태 확인 필요"
  );
}

function getStatusClass(status) {
  switch (status) {
    case "ON_SALE":
      return "is-selling";

    case "SOLD_OUT":
      return "is-soldout";

    case "PAUSED":
      return "is-paused";

    default:
      return "is-unknown";
  }
}

function formatPrice(value) {
  if (value === "" || value == null) {
    return "-";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("ko-KR")}원`
    : "-";
}

// ==========================================
// 데모 상품 설명 표시 처리
// ==========================================

// 데모 안내 문구가 들어 있는 상품만
// 상품 목록에서 설명 영역을 숨긴다.
// API 응답이나 DB에 저장된 원본은 수정하지 않는다.

function shouldHideDemoDescription(description) {
  const text = String(description ?? "").trim();

  return text.startsWith("[DEMO_CATALOG_V1]");
}

// ==========================================
// API 목록 응답 정규화
// ==========================================

function extractItems(data, label) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  throw new Error(
    `${label} 응답 형식이 올바르지 않습니다.`
  );
}

// ==========================================
// 구매 목적 카테고리
// ==========================================

function extractPurposeCategories(data) {
  const roots = extractItems(
    data,
    "구매 목적 카테고리"
  );

  const results = [];
  const seenIds = new Set();

  function addCategory(item) {
    if (
      !item ||
      item.id == null ||
      !String(item.name ?? "").trim()
    ) {
      return;
    }

    const id = String(item.id);

    if (seenIds.has(id)) {
      return;
    }

    seenIds.add(id);

    results.push({
      ...item,
      id,
    });
  }

  function walk(items, depth = 0) {
    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (!Array.isArray(item.children)) {
        addCategory(item);
        continue;
      }

      if (item.children.length > 0) {
        walk(item.children, depth + 1);
        continue;
      }

      if (depth > 0) {
        addCategory(item);
      }
    }
  }

  walk(roots);

  return results;
}

// ==========================================
// 상품 입력값 검증
// ==========================================

function validateProduct(form, categories) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "상품명을 입력해 주세요.";
  }

  const price = Number(form.price_amount);

  if (
    form.price_amount === "" ||
    !Number.isSafeInteger(price) ||
    price <= 0
  ) {
    errors.price_amount =
      "가격은 1원 이상의 정수로 입력해 주세요.";
  }

  const minutes = Number(form.preparation_minutes);

  if (
    form.preparation_minutes === "" ||
    !Number.isSafeInteger(minutes) ||
    minutes < 0
  ) {
    errors.preparation_minutes =
      "준비시간은 0 이상의 정수로 입력해 주세요.";
  }

  if (form.image_url.trim()) {
    try {
      const url = new URL(form.image_url);

      if (
        !["http:", "https:"].includes(url.protocol)
      ) {
        errors.image_url =
          "http 또는 https 이미지 주소를 입력해 주세요.";
      }
    } catch {
      errors.image_url =
        "올바른 이미지 URL을 입력해 주세요.";
    }
  }

  const selectedIds = form.purpose_category_ids;

  if (
    !Array.isArray(selectedIds) ||
    selectedIds.length === 0
  ) {
    errors.purpose_category_ids =
      "구매 목적 태그를 하나 이상 선택해 주세요.";
  } else {
    const validIds = new Set(
      categories.map((category) =>
        String(category.id)
      )
    );

    const invalidSelection = selectedIds.some(
      (id) => !validIds.has(String(id))
    );

    if (invalidSelection) {
      errors.purpose_category_ids =
        "사용할 수 없는 구매 목적 태그가 포함되어 있습니다.";
    }
  }

  return errors;
}

// ==========================================
// 상품 이미지
// ==========================================

function ProductImage({
  src,
  alt,
  large = false,
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const className = `owner-product__image ${
    large ? "owner-product__image--large" : ""
  }`;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${className} owner-product__placeholder`}
      role="img"
      aria-label="상품 이미지 없음"
    >
      <Package size={large ? 42 : 26} />
    </div>
  );
}

// ==========================================
// 공통 입력 필드
// ==========================================

function ProductField({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder = "",
  min,
  maxLength,
}) {
  return (
    <label className="owner-product__field">
      <span>{label}</span>

      <input
        type={type}
        value={value}
        min={min}
        step={type === "number" ? "1" : undefined}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        aria-invalid={Boolean(error)}
      />

      {error && (
        <small
          className="owner-product__field-error"
          role="alert"
        >
          {error}
        </small>
      )}
    </label>
  );
}

// ==========================================
// 판매 상태 배지
// ==========================================

function SaleStatusBadge({ status }) {
  return (
    <span
      className={`owner-product__status-badge ${getStatusClass(
        status
      )}`}
    >
      <span
        className="owner-product__status-dot"
        aria-hidden="true"
      />

      {getStatusLabel(status)}
    </span>
  );
}

// ==========================================
// 상품 설명
// ==========================================

function ProductDescription({ description }) {
  const [expanded, setExpanded] = useState(false);

  const [isOverflowing, setIsOverflowing] =
    useState(false);

  const [textElement, setTextElement] =
    useState(null);

  const content = String(
    description ?? ""
  ).trim();

  useEffect(() => {
    if (!textElement || !content) {
      return;
    }

    function checkOverflow() {
      const style = window.getComputedStyle(
        textElement
      );

      const lineHeight = parseFloat(
        style.lineHeight
      );

      if (!Number.isFinite(lineHeight)) {
        return;
      }

      const maxHeight = lineHeight * 3;

      setIsOverflowing(
        textElement.scrollHeight > maxHeight + 1
      );
    }

    checkOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(
      checkOverflow
    );

    observer.observe(textElement);

    return () => observer.disconnect();
  }, [textElement, content]);

  useEffect(() => {
    setExpanded(false);
  }, [content]);

  return (
    <div className="owner-product__description-box">
      <p className="owner-product__description-label">
        상품 설명
      </p>

      <p
        ref={setTextElement}
        className={`owner-product__description-text ${
          expanded ? "is-expanded" : ""
        }`}
      >
        {content || "등록된 상품 설명이 없어요."}
      </p>

      {content && isOverflowing && (
        <button
          type="button"
          className="owner-product__more-button"
          onClick={() =>
            setExpanded((previous) => !previous)
          }
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              접기
              <ChevronUp size={14} />
            </>
          ) : (
            <>
              더 보기
              <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ==========================================
// 상품 목록 카드
// ==========================================

function ProductCard({
  product,
  storeName,
  onEdit,
  onStatus,
}) {
  // 데모 안내 설명인지 확인
  const hideDescription =
    shouldHideDemoDescription(
      product.description
    );

  return (
    <article className="owner-product__card">
      <div className="owner-product__product-row">
        <ProductImage
          src={product.image_url}
          alt={product.name}
        />

        <div className="owner-product__product-info">
          <span className="owner-product__store-name">
            {storeName}
          </span>

          <strong className="owner-product__product-name">
            {product.name}
          </strong>

          <b className="owner-product__product-price">
            {formatPrice(product.price_amount)}
          </b>

          <small className="owner-product__prep-time">
            준비시간 약{" "}
            {product.preparation_minutes ?? "-"}분
          </small>
        </div>
      </div>

      {/* 데모 상품의 설명 박스만 숨긴다 */}
      {!hideDescription && (
        <ProductDescription
          description={product.description}
        />
      )}

      <div className="owner-product__status-row">
        <span className="owner-product__status-title">
          판매 상태
        </span>

        <SaleStatusBadge
          status={product.sale_status}
        />
      </div>

      <div className="owner-product__card-actions">
        <button
          type="button"
          className="owner-product__secondary"
          onClick={() => onEdit(product)}
        >
          상품 수정
        </button>

        <button
          type="button"
          className="owner-product__secondary"
          onClick={() => onStatus(product)}
        >
          판매 상태 변경
        </button>
      </div>
    </article>
  );
}

// ==========================================
// 상품 관리 페이지
// ==========================================

function OwnerProductPage() {
  const navigate = useNavigate();

  // ==========================================
  // 점포 / 상품 / 카테고리 데이터
  // ==========================================

  const [stores, setStores] = useState([]);

  const [storeId, setStoreId] = useState("");

  const [products, setProducts] = useState([]);

  const [categories, setCategories] = useState([]);

  // list / create / edit / status / success
  const [view, setView] = useState("list");

  const [form, setForm] = useState({
    ...EMPTY_PRODUCT,
    purpose_category_ids: [],
  });

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [selectedStatus, setSelectedStatus] =
    useState("ON_SALE");

  const [completedAction, setCompletedAction] =
    useState("");

  // ==========================================
  // 요청 상태
  // ==========================================

  const [loadingBase, setLoadingBase] =
    useState(true);

  const [loadingProducts, setLoadingProducts] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [formError, setFormError] = useState("");

  const [fieldErrors, setFieldErrors] =
    useState({});

  const [reloadKey, setReloadKey] = useState(0);

  const [baseReloadKey, setBaseReloadKey] =
    useState(0);

  // ==========================================
  // 내 점포 및 구매 목적 조회
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadBaseData() {
      setLoadingBase(true);
      setError("");

      try {
        const [
          ownerStoresResult,
          purposeCategoriesResult,
        ] = await Promise.all([
          getOwnerStores(),
          getPurposeCategories(),
        ]);

        if (!active) return;

        const ownerStores = extractItems(
          ownerStoresResult,
          "점포 목록"
        );

        const purposeCategories =
          extractPurposeCategories(
            purposeCategoriesResult
          );

        setStores(ownerStores);
        setCategories(purposeCategories);

        setStoreId((previous) => {
          const exists = ownerStores.some(
            (store) =>
              String(store.id) ===
              String(previous)
          );

          return exists
            ? String(previous)
            : String(ownerStores[0]?.id ?? "");
        });
      } catch (err) {
        if (!active) return;

        setError(
          err.message ??
            "상품 관리 정보를 불러오지 못했습니다."
        );
      } finally {
        if (active) {
          setLoadingBase(false);
        }
      }
    }

    loadBaseData();

    return () => {
      active = false;
    };
  }, [baseReloadKey]);

  // ==========================================
  // 선택한 점포의 상품 조회
  // ==========================================

  useEffect(() => {
    if (!storeId) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    let active = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setError("");

      try {
        const result = await getOwnerProducts(
          storeId
        );

        if (!active) return;

        const productItems = extractItems(
          result,
          "상품 목록"
        );

        setProducts(productItems);
      } catch (err) {
        if (active) {
          setError(
            err.message ??
              "상품 목록을 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [storeId, reloadKey]);

  // ==========================================
  // 파생 데이터
  // ==========================================

  const loading =
    loadingBase || loadingProducts;

  const selectedStore = stores.find(
    (store) =>
      String(store.id) === String(storeId)
  );

  // ==========================================
  // 상품 등록 화면
  // ==========================================

  function openCreate() {
    setForm({
      ...EMPTY_PRODUCT,
      purpose_category_ids: [],
    });

    setSelectedProduct(null);
    setFieldErrors({});
    setFormError("");

    setView("create");
  }

  // ==========================================
  // 상품 수정 화면
  // ==========================================

  function openEdit(product) {
    setSelectedProduct(product);

    // 수정 화면에는 원본 설명을 유지한다.
    // 데모 안내 문구를 임의로 지우지 않는다.
    setForm({
      name: product.name ?? "",

      price_amount: String(
        product.price_amount ?? ""
      ),

      description:
        product.description ?? "",

      preparation_minutes: String(
        product.preparation_minutes ?? ""
      ),

      image_url:
        product.image_url ?? "",

      purpose_category_ids:
        Array.isArray(
          product.purpose_category_ids
        )
          ? product.purpose_category_ids.map(
              String
            )
          : [],
    });

    setFieldErrors({});
    setFormError("");

    setView("edit");
  }

  // ==========================================
  // 판매 상태 변경 화면
  // ==========================================

  function openStatus(product) {
    setSelectedProduct(product);

    setSelectedStatus(
      product.sale_status ?? "ON_SALE"
    );

    setFormError("");
    setView("status");
  }

  // ==========================================
  // 상품 목록으로 돌아가기
  // ==========================================

  function goToList() {
    if (saving) return;

    setView("list");
    setFormError("");
    setFieldErrors({});
  }

  // ==========================================
  // 뒤로가기
  // ==========================================

  function handleBack() {
    if (saving) return;

    if (view === "list") {
      navigate("/owner");
    } else {
      goToList();
    }
  }

  // ==========================================
  // 상품 입력값 관리
  // ==========================================

  function updateField(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: "",
    }));

    setFormError("");
  }

  // ==========================================
  // 구매 목적 태그 선택
  // ==========================================

  function toggleCategory(categoryId) {
    const id = String(categoryId);

    const available = categories.some(
      (category) =>
        String(category.id) === id
    );

    if (!available) {
      setFormError(
        "선택할 수 없는 구매 목적 태그입니다."
      );
      return;
    }

    setForm((previous) => {
      const exists =
        previous.purpose_category_ids.includes(
          id
        );

      return {
        ...previous,

        purpose_category_ids: exists
          ? previous.purpose_category_ids.filter(
              (item) => item !== id
            )
          : [
              ...previous.purpose_category_ids,
              id,
            ],
      };
    });

    setFieldErrors((previous) => ({
      ...previous,
      purpose_category_ids: "",
    }));

    setFormError("");
  }

  // ==========================================
  // 상품 등록 / 수정
  // ==========================================

  async function handleSaveProduct(event) {
    event.preventDefault();

    if (saving || !storeId) return;

    const validation = validateProduct(
      form,
      categories
    );

    setFieldErrors(validation);

    if (Object.keys(validation).length > 0) {
      setFormError(
        "입력한 상품 정보를 다시 확인해 주세요."
      );
      return;
    }

    const payload = {
      name: form.name.trim(),

      price_amount: Number(
        form.price_amount
      ),

      description:
        form.description.trim(),

      preparation_minutes: Number(
        form.preparation_minutes
      ),

      image_url:
        form.image_url.trim() || null,

      purpose_category_ids:
        form.purpose_category_ids.map(
          String
        ),
    };

    setSaving(true);
    setFormError("");

    try {
      if (view === "create") {
        await createOwnerProduct(
          storeId,
          payload
        );

        setCompletedAction(
          "상품 등록이 완료됐어요."
        );
      } else {
        if (!selectedProduct?.id) {
          throw new Error(
            "수정할 상품을 찾을 수 없습니다."
          );
        }

        await updateOwnerProduct(
          storeId,
          selectedProduct.id,
          payload
        );

        setCompletedAction(
          "상품 정보가 저장됐어요."
        );
      }

      setView("success");

      setReloadKey(
        (value) => value + 1
      );
    } catch (err) {
      setFormError(
        err.message ??
          "상품을 저장하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // 판매 상태 변경
  // ==========================================

  async function handleSaveStatus() {
    if (saving || !selectedProduct) return;

    setSaving(true);
    setFormError("");

    try {
      await updateOwnerProductSaleStatus(
        storeId,
        selectedProduct.id,
        selectedStatus
      );

      setCompletedAction(
        "판매 상태가 반영됐어요."
      );

      setView("success");

      setReloadKey(
        (value) => value + 1
      );
    } catch (err) {
      setFormError(
        err.message ??
          "판매 상태를 변경하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // 로그아웃
  // ==========================================

  async function handleLogout() {
    if (saving) return;

    try {
      await logout();

      navigate("/select-role", {
        replace: true,
      });
    } catch (err) {
      setError(
        err.message ??
          "로그아웃에 실패했습니다."
      );
    }
  }

  // ==========================================
  // 다시 시도
  // ==========================================

  function handleRetry() {
    setError("");

    setBaseReloadKey(
      (value) => value + 1
    );

    setReloadKey(
      (value) => value + 1
    );
  }

  // ==========================================
  // 화면 제목
  // ==========================================

  const headerTitles = {
    list: "상품 관리",
    create: "상품 등록",
    edit: "상품 수정",
    status: "판매 상태 변경",
    success: "저장 완료",
  };

  // ==========================================
  // JSX
  // ==========================================

  return (
    <main className="owner-product">
      {/* ======================================
          상단 헤더
      ====================================== */}

      <header className="owner-product__header">
        <button
          type="button"
          className="owner-product__back"
          onClick={handleBack}
          disabled={saving}
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1>{headerTitles[view]}</h1>

        <span className="owner-product__header-spacer" />
      </header>

      {/* ======================================
          로딩
      ====================================== */}

      {loading && view === "list" && (
        <div
          className="owner-product__feedback"
          role="status"
        >
          <div className="owner-product__skeleton" />

          <div className="owner-product__skeleton" />

          <p>상품 정보를 불러오는 중...</p>
        </div>
      )}

      {/* ======================================
          API 오류
      ====================================== */}

      {!loading && error && view === "list" && (
        <section
          className="owner-product__feedback"
          role="alert"
        >
          <AlertCircle size={30} />

          <h2>
            상품 정보를 불러오지 못했어요
          </h2>

          <p>{error}</p>

          <button
            type="button"
            className="owner-product__primary"
            onClick={handleRetry}
          >
            <RefreshCw size={17} />
            다시 시도
          </button>
        </section>
      )}

      {/* ======================================
          상품 목록
      ====================================== */}

      {view === "list" &&
        !loading &&
        !error && (
          <div className="owner-product__layout">
            <div className="owner-product__content">
              {!selectedStore ? (
                <section className="owner-product__feedback owner-product__feedback--inline">
                  <Store size={31} />

                  <h2>등록된 점포가 없어요</h2>

                  <p>
                    상품을 등록하려면 점포를 먼저
                    등록해 주세요.
                  </p>

                  <button
                    type="button"
                    className="owner-product__primary"
                    onClick={() =>
                      navigate("/owner")
                    }
                  >
                    점포 등록하기
                  </button>
                </section>
              ) : (
                <>
                  {/* 여러 점포 선택 */}

                  {stores.length > 1 && (
                    <label className="owner-product__field">
                      <span>관리할 점포</span>

                      <select
                        value={storeId}
                        onChange={(event) =>
                          setStoreId(
                            event.target.value
                          )
                        }
                      >
                        {stores.map((store) => (
                          <option
                            value={store.id}
                            key={store.id}
                          >
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <h2 className="owner-product__store-heading">
                    {selectedStore.name} 상품
                  </h2>

                  {products.length === 0 ? (
                    <section className="owner-product__empty">
                      <Box size={29} />

                      <h3>등록된 상품이 없어요.</h3>

                      <p>
                        새로운 상품을 등록해 주세요.
                      </p>
                    </section>
                  ) : (
                    <div className="owner-product__list">
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          storeName={
                            selectedStore.name
                          }
                          onEdit={openEdit}
                          onStatus={openStatus}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedStore && (
              <footer className="owner-product__footer">
                <button
                  type="button"
                  className="owner-product__primary"
                  onClick={openCreate}
                >
                  새 상품 등록
                </button>
              </footer>
            )}

            {/* 하단 네비게이션 */}

            <nav
              className="owner-product__bottom-nav"
              aria-label="사장님 메뉴"
            >
              <button
                type="button"
                onClick={() =>
                  navigate("/owner/orders")
                }
              >
                <ClipboardList size={20} />
                <span>주문</span>
              </button>

              <button
                type="button"
                className="is-active"
                aria-current="page"
              >
                <Package size={20} />
                <span>상품</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/owner")
                }
              >
                <Store size={20} />
                <span>점포</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={20} />
                <span>로그아웃</span>
              </button>
            </nav>
          </div>
        )}

      {/* ======================================
          상품 등록 / 수정
      ====================================== */}

      {(view === "create" ||
        view === "edit") && (
        <form
          className="owner-product__layout"
          onSubmit={handleSaveProduct}
          noValidate
        >
          <div className="owner-product__content">
            {/* 상품 이미지 */}

            <section className="owner-product__photo-section">
              <ProductImage
                src={form.image_url}
                alt={
                  form.name || "상품 미리보기"
                }
                large
              />

              <label className="owner-product__image-input">
                이미지 URL

                <input
                  type="url"
                  value={form.image_url}
                  placeholder="https://example.com/image.jpg"
                  onChange={(event) =>
                    updateField(
                      "image_url",
                      event.target.value
                    )
                  }
                />
              </label>

              {fieldErrors.image_url && (
                <small className="owner-product__field-error">
                  {fieldErrors.image_url}
                </small>
              )}

              <p className="owner-product__help">
                현재는 이미지 파일 업로드 대신
                공개 이미지 URL을 사용해요.
              </p>
            </section>

            {/* 상품명 */}

            <ProductField
              label="상품명"
              value={form.name}
              maxLength={100}
              placeholder="상품명을 입력해 주세요"
              error={fieldErrors.name}
              onChange={(value) =>
                updateField("name", value)
              }
            />

            {/* 가격 */}

            <ProductField
              label="가격 (원)"
              type="number"
              min="1"
              value={form.price_amount}
              placeholder="예: 25000"
              error={fieldErrors.price_amount}
              onChange={(value) =>
                updateField(
                  "price_amount",
                  value
                )
              }
            />

            {/* 준비시간 */}

            <ProductField
              label="준비시간 (분)"
              type="number"
              min="0"
              value={form.preparation_minutes}
              placeholder="예: 60"
              error={
                fieldErrors.preparation_minutes
              }
              onChange={(value) =>
                updateField(
                  "preparation_minutes",
                  value
                )
              }
            />

            {/* 상품 설명 */}

            <label className="owner-product__field">
              <span>상품 설명</span>

              <textarea
                rows={4}
                maxLength={1000}
                placeholder="상품의 특징이나 구성 등을 입력해 주세요"
                value={form.description}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value
                  )
                }
              />

              <small className="owner-product__character-count">
                {form.description.length}/1000
              </small>
            </label>

            {/* 구매 목적 태그 */}

            <section className="owner-product__tags">
              <h3>구매 목적 태그</h3>

              <p>
                이 상품이 어울리는 구매 목적을
                선택해 주세요.
              </p>

              {categories.length > 0 ? (
                <div className="owner-product__tag-list">
                  {categories.map((category) => {
                    const selected =
                      form.purpose_category_ids.includes(
                        String(category.id)
                      );

                    return (
                      <button
                        type="button"
                        key={category.id}
                        className={`owner-product__tag ${
                          selected
                            ? "is-selected"
                            : ""
                        }`}
                        aria-pressed={selected}
                        onClick={() =>
                          toggleCategory(
                            category.id
                          )
                        }
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="owner-product__help">
                  구매 목적 태그를
                  불러올 수 없어요.
                </p>
              )}

              {fieldErrors.purpose_category_ids && (
                <small className="owner-product__field-error">
                  {
                    fieldErrors.purpose_category_ids
                  }
                </small>
              )}
            </section>

            {formError && (
              <p
                className="owner-product__error"
                role="alert"
              >
                <AlertCircle size={17} />
                {formError}
              </p>
            )}
          </div>

          <footer className="owner-product__footer">
            <button
              type="submit"
              className="owner-product__primary"
              disabled={saving}
            >
              {saving
                ? "상품 저장 중..."
                : view === "create"
                  ? "상품 등록"
                  : "변경사항 저장"}
            </button>
          </footer>
        </form>
      )}

      {/* ======================================
          판매 상태 변경
      ====================================== */}

      {view === "status" &&
        selectedProduct && (
          <div className="owner-product__layout">
            <div className="owner-product__content">
              <div className="owner-product__product-row">
                <ProductImage
                  src={
                    selectedProduct.image_url
                  }
                  alt={selectedProduct.name}
                />

                <div className="owner-product__product-info">
                  <span className="owner-product__store-name">
                    {selectedStore?.name}
                  </span>

                  <strong className="owner-product__product-name">
                    {selectedProduct.name}
                  </strong>

                  <b className="owner-product__product-price">
                    {formatPrice(
                      selectedProduct.price_amount
                    )}
                  </b>
                </div>
              </div>

              <div className="owner-product__status-row">
                <span className="owner-product__status-title">
                  현재 판매 상태
                </span>

                <SaleStatusBadge
                  status={
                    selectedProduct.sale_status
                  }
                />
              </div>

              <section className="owner-product__status-options">
                <h2>
                  판매 상태를 선택해 주세요.
                </h2>

                {SALE_STATUSES.map((status) => {
                  const selected =
                    selectedStatus === status.value;

                  return (
                    <button
                      key={status.value}
                      type="button"
                      className={`owner-product__status-option ${getStatusClass(
                        status.value
                      )} ${
                        selected
                          ? "is-selected"
                          : ""
                      }`}
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedStatus(
                          status.value
                        )
                      }
                    >
                      <span className="owner-product__status-option-main">
                        <span className="owner-product__status-option-dot" />

                        <span className="owner-product__status-option-text">
                          <strong>
                            {status.label}
                          </strong>

                          <small>
                            {status.description}
                          </small>
                        </span>
                      </span>

                      <span
                        className="owner-product__status-radio"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </section>

              <p className="owner-product__notice">
                품절 또는 판매 중지 상태의
                상품은 새로운 예약 신청에서
                제외되어야 해요.
                실제 예약 가능 여부는 서버가
                최종 확인합니다.
              </p>

              {formError && (
                <p
                  className="owner-product__error"
                  role="alert"
                >
                  <AlertCircle size={17} />
                  {formError}
                </p>
              )}
            </div>

            <footer className="owner-product__footer">
              <button
                type="button"
                className="owner-product__primary"
                disabled={saving}
                onClick={handleSaveStatus}
              >
                {saving
                  ? "변경 중..."
                  : "판매 상태 저장"}
              </button>
            </footer>
          </div>
        )}

      {/* ======================================
          저장 완료
      ====================================== */}

      {view === "success" && (
        <div className="owner-product__layout">
          <section className="owner-product__feedback owner-product__feedback--success">
            <CheckCircle2 size={38} />

            <h2>{completedAction}</h2>

            <p>
              변경된 정보가 상품 관리에
              반영됐어요.
            </p>
          </section>

          <footer className="owner-product__footer">
            <button
              type="button"
              className="owner-product__primary"
              onClick={goToList}
            >
              상품 목록으로
            </button>
          </footer>
        </div>
      )}
    </main>
  );
}

export default OwnerProductPage;
