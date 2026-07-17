// ==========================================
// 1. SESSION MANAGEMENT & LAYOUT SWITCHER
// ==========================================
const userToken = localStorage.getItem("userToken");

function applySessionLayout() {
    const authCard = document.getElementById("authCard") || document.querySelector(".auth-form-padding");
    const dashboard = document.getElementById("dashboard");

    if (userToken) {
        if (authCard) authCard.style.setProperty("display", "none", "important");
        if (dashboard) dashboard.style.setProperty("display", "block", "important");
    } else {
        if (authCard) authCard.style.setProperty("display", "block", "important");
        if (dashboard) dashboard.style.setProperty("display", "none", "important");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySessionLayout);
} else {
    applySessionLayout();
}

// ==========================================
// 2. YOUR ORIGINAL LOGIN / REGISTER SUBMIT LOGIC
// ==========================================
const authForm = document.getElementById("authForm") || document.querySelector("form");
const toggleAuthMode = document.getElementById("toggleAuthMode");
let isRegisterMode = false;

if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Target form fields dynamically based on your layout setup
        const phoneOrEmailInput = authForm.querySelector("input[type='tel']") || authForm.querySelector("input[type='text']");
        const passwordInput = authForm.querySelector("input[type='password']");
        const nameInput = document.getElementById("name");

        if (!phoneOrEmailInput || !passwordInput) {
            alert("Form inputs missing. Please verify your input field attributes.");
            return;
        }

        const payload = {
            identifier: phoneOrEmailInput.value,
            password: passwordInput.value,
            ...(isRegisterMode && nameInput && { name: nameInput.value })
        };

        const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (isRegisterMode) {
                    alert("Registration successful! Switching to login...");
                    if (toggleAuthMode) toggleAuthMode.click();
                } else {
                    alert("Login successful!");
                    localStorage.setItem("userToken", data.token);
                    window.location.reload(); 
                }
            } else {
                alert(data.message || "An authentication error occurred.");
            }
        } catch (error) {
            console.error("Auth submit error:", error);
            alert("Cannot connect to server. Check your backend status.");
        }
    });
}

// ==========================================
// 3. DYNAMIC DATA PURCHASE FEATURE
// ==========================================
const dataPlansDataset = {
    MTN: {
        SME: [
            { id: "mtn-sme-1gb", name: "MTN SME 1GB (30 Days)", price: 230 },
            { id: "mtn-sme-2gb", name: "MTN SME 2GB (30 Days)", price: 460 },
            { id: "mtn-sme-5gb", name: "MTN SME 5GB (30 Days)", price: 1150 }
        ],
        "CORPORATE GIFTING": [
            { id: "mtn-cg-1gb", name: "MTN CG 1GB (30 Days)", price: 250 },
            { id: "mtn-cg-5gb", name: "MTN CG 5GB (30 Days)", price: 1250 }
        ],
        GIFTING: [
            { id: "mtn-gift-1gb", name: "MTN Gifting 1GB (30 Days)", price: 290 }
        ]
    },
    AIRTEL: {
        SME: [{ id: "airtel-sme-1gb", name: "Airtel SME 1GB (30 Days)", price: 220 }],
        "CORPORATE GIFTING": [
            { id: "airtel-cg-1gb", name: "Airtel CG 1GB (30 Days)", price: 240 },
            { id: "airtel-cg-5gb", name: "Airtel CG 5GB (30 Days)", price: 1200 }
        ],
        GIFTING: [{ id: "airtel-gift-1gb", name: "Airtel Gifting 1.5GB (30 Days)", price: 1000 }]
    },
    GLO: {
        "CORPORATE GIFTING": [{ id: "glo-cg-1gb", name: "Glo CG 1GB (30 Days)", price: 245 }],
        GIFTING: [{ id: "glo-gift-1gb", name: "Glo Gifting 1.35GB (14 Days)", price: 480 }]
    },
    "9MOBILE": {
        "CORPORATE GIFTING": [{ id: "9mob-cg-1gb", name: "9Mobile CG 1GB (30 Days)", price: 200 }],
        GIFTING: [{ id: "9mob-gift-1gb", name: "9mobile Gifting 1GB (30 Days)", price: 450 }]
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const buyDataBtn = document.getElementById("buyData");
    const dataModal = document.getElementById("dataModal");
    const closeDataModal = document.getElementById("closeDataModal");
    const dataNetwork = document.getElementById("dataNetwork");
    const dataType = document.getElementById("dataType");
    const dataPlan = document.getElementById("dataPlan");
    const dataPurchaseForm = document.getElementById("dataPurchaseForm");

    if (buyDataBtn && dataModal) {
        buyDataBtn.addEventListener("click", () => dataModal.style.display = "flex");
    }

    if (closeDataModal && dataModal) {
        closeDataModal.addEventListener("click", () => {
            dataModal.style.display = "none";
            if (dataPurchaseForm) dataPurchaseForm.reset();
            resetDropdowns();
        });
    }

    function resetDropdowns() {
        if (dataType) {
            dataType.innerHTML = '<option value="">-- Select Network First --</option>';
            dataType.disabled = true;
        }
        if (dataPlan) {
            dataPlan.innerHTML = '<option value="">-- Select Type First --</option>';
            dataPlan.disabled = true;
        }
    }

    if (dataNetwork) {
        dataNetwork.addEventListener("change", (e) => {
            const selectedNetwork = e.target.value;
            resetDropdowns();

            if (selectedNetwork && dataPlansDataset[selectedNetwork] && dataType) {
                dataType.innerHTML = '<option value="">-- Select Type --</option>';
                Object.keys(dataPlansDataset[selectedNetwork]).forEach(type => {
                    dataType.innerHTML += `<option value="${type}">${type}</option>`;
                });
                dataType.disabled = false;
            }
        });
    }

    if (dataType) {
        dataType.addEventListener("change", (e) => {
            const selectedNetwork = dataNetwork ? dataNetwork.value : "";
            const selectedType = e.target.value;

            if (dataPlan) {
                dataPlan.innerHTML = '<option value="">-- Select Plan --</option>';
                dataPlan.disabled = true;

                if (selectedNetwork && selectedType && dataPlansDataset[selectedNetwork][selectedType]) {
                    const plans = dataPlansDataset[selectedNetwork][selectedType];
                    plans.forEach(plan => {
                        dataPlan.innerHTML += `<option value="${plan.id}" data-price="${plan.price}">${plan.name} - ₦${plan.price}</option>`;
                    });
                    dataPlan.disabled = false;
                }
            }
        });
    }
});