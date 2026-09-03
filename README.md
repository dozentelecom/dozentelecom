# Dozentelecom

Next.js/MongoDB VTU platform using SME API for downstream VTU and bill-payment services and Paystack for customer funding/payment.

## Environment
```env
SME_API_URL=https://smeapi.com.ng/api
SME_API_KEY=YOUR_SME_API_KEY
SME_API_TIMEOUT_MS=20000
```
Keep provider keys server-side. Do not commit `.env`.

## SME API integration
- Data plans: `GET /api/dataplans/`
- Data purchase: `POST /api/data/`
- Airtime: `POST /api/airtime/`
- Catalog: `GET /api/catalog/`
- Cable verification/purchase: `/api/cabletv/verify/`, `/api/cabletv/`
- Electricity verification/purchase: `/api/electricity/verify/`, `/api/electricity/`
- Exam PIN: `POST /api/exam/`
- Transaction status: `POST /api/status/`
- Provider balance: `GET /api/user/`
- Data/recharge PINs, Bulk SMS and Smile are also routed through server-side SME API endpoints.

## Data flow
The browser requests `/api/sme/data-plans`; the server calls SME API and returns the live plans/prices. The selected numeric network ID and plan ID are then sent to `/api/sme/data` for purchase.

Paystack remains independent from the SME API and handles customer funding/payment.
