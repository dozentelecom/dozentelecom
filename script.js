const dataPlans = {
    mtn: [
        { id: "1", name: "MTN SME 1GB (30 days)", price: 260 },
        { id: "2", name: "MTN SME 2GB (30 days)", price: 520 },
        { id: "5", name: "MTN SME 5GB (30 days)", price: 1300 }
    ],
    airtel: [{ id: "11", name: "Airtel CG 1GB (30 days)", price: 270 }],
    glo: [{ id: "21", name: "Glo Gift 1.35GB (30 days)", price: 430 }],
    "9mobile": [{ id: "31", name: "9mobile 1GB (30 days)", price: 400 }]
};

let loggedInUserPhone = ""; 
let isLoginMode = true;

const serviceSelect = document.getElementById('service');
const networkSelect = document.getElementById('network');
const amountGroup = document.getElementById('amountGroup');
const toggleAuthLink = document.getElementById('toggleAuthMode');

// Toggles visual views between Logging in vs Creating an account
toggleAuthLink.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        document.getElementById('authTitle').innerText = "Welcome Back";
        document.getElementById('authSubtitle').innerText = "Login to access cheap data and airtime plans";
        document.getElementById('mainAuthBtn').innerText = "Login";
        toggleAuthLink.innerText = "Don't have an account? Create Account";
        document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'none');
    } else {
        document.getElementById('authTitle').innerText = "Create Account";
        document.getElementById('authSubtitle').innerText = "Join Dozentelecom platform for free";
        document.getElementById('mainAuthBtn').innerText = "Sign Up";
        toggleAuthLink.innerText = "Already registered? Login Here";
        document.querySelectorAll('.reg-only').forEach(el => el.style.display = 'block');
    }
});

// Handles form registration or verification on click
document.getElementById('mainAuthBtn').addEventListener('click', async () => {
    const phone = document.getElementById('authPhone').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!phone || !password) {
        alert("Please provide phone and password.");
        return;
    }

    if (isLoginMode) {
        // LOGIN OPERATION
        try {
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (data.success) {
                loggedInUserPhone = data.user.phone;
                document.getElementById('userGreeting').innerText = data.user.name;
                document.getElementById('authCard').style.display = 'none';
                document.getElementById('transactionCard').style.display = 'block';
                document.getElementById('logoutSection').style.display = 'block';
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Backend logic engine is offline.");
        }
    } else {
        // REGISTRATION OPERATION
        const name = document.getElementById('authName').value.trim();
        const pin = document.getElementById('authPin').value.trim();

        if (!name || pin.length !== 4) {
            alert("Please fill in your name and ensure security PIN is exactly 4 digits.");
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, password, pin })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                toggleAuthLink.click(); // resets UI back to login mode
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Registration request failed.");
        }
    }
});

// Sign Out Routine
document.getElementById('logoutBtn').addEventListener('click', () => {
    loggedInUserPhone = "";
    document.getElementById('authPhone').value = "";
    document.getElementById('authPassword').value = "";
    document.getElementById('transactionCard').style.display = 'none';
    document.getElementById('logoutSection').style.display = 'none';
    document.getElementById('authCard').style.display = 'block';
});

// Update standard dynamic package fields
serviceSelect.addEventListener('change', updateFormFields);
networkSelect.addEventListener('change', updateFormFields);

function updateFormFields() {
    const service = serviceSelect.value;
    const network = networkSelect.value;

    if (service === 'data') {
        if (!network) {
            amountGroup.innerHTML = `
                <label>Select Data Plan</label>
                <select disabled><option>Choose network provider...</option></select>
            `;
            return;
        }
        let options = (dataPlans[network] || []).map(p => `<option value="${p.id}">${p.name} - ₦${p.price}</option>`).join('');
        amountGroup.innerHTML = `
            <label for="dataPlan">Select Data Plan</label>
            <select id="dataPlan" required><option value="" disabled selected>Choose bundle</option>${options}</select>
        `;
    } else {
        amountGroup.innerHTML = `
            <label for="amount">Amount (₦)</label>
            <input type="number" id="amount" min="100" placeholder="Minimum 100" required>
        `;
    }
}

// Intercept Purchase form submission and push payment requests with secure confirmation pin validation
document.getElementById('rechargeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const network = networkSelect.value;
    const service = serviceSelect.value;
    const phone = document.getElementById('phone').value;
    const pin = document.getElementById('confirmPin').value;
    
    let amount = 0;
    let planId = "";

    if (service === 'data') {
        const dataPlanSelect = document.getElementById('dataPlan');
        planId = dataPlanSelect.value;
        const selectedPlan = dataPlans[network].find(p => p.id === planId);
        amount = selectedPlan.price;
    } else {
        amount = document.getElementById('amount').value;
    }

    try {
        const response = await fetch('http://localhost:5000/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: "customer_dozen@example.com", 
                amount: amount,
                userPhone: loggedInUserPhone,
                transactionPin: pin,
                metadata: { phone, network, serviceType: service, planId }
            })
        });

        const data = await response.json();

        if (data.success && data.authorization_url) {
            window.location.href = data.authorization_url;
        } else {
            alert(data.message || "Execution blocked.");
        }
    } catch (error) {
        alert("Unable to establish backend link.");
    }
});