# Dozentelecom API flow

Customer browser calls only local Next.js routes. Provider credentials remain server-side.

## SME API
- GET `/api/sme/data-plans` -> SME `GET /dataplans/`
- POST `/api/sme/data` -> SME `POST /data/`
- POST `/api/sme/airtime` -> SME `POST /airtime/`
- GET `/api/sme/services` -> SME `GET /catalog/`
- POST `/api/sme/cable/verify` -> SME `POST /cabletv/verify/`
- POST `/api/sme/cable/buy` -> SME `POST /cabletv/`
- POST `/api/sme/electricity/verify` -> SME `POST /electricity/verify/`
- POST `/api/sme/electricity/buy` -> SME `POST /electricity/`
- POST `/api/sme/education` -> SME `POST /exam/`
- POST `/api/sme/status` -> SME `POST /status/`
- GET `/api/sme/balance` -> SME `GET /user/` (admin/monitoring use)
- POST `/api/sme/datapin` -> SME `POST /datapin/`
- POST `/api/sme/rechargepin` -> SME `POST /rechargepin/`
- POST `/api/sme/bulksms` -> SME `POST /bulksms/`
- POST `/api/sme/smile-data` -> SME `POST /smile-data/`

## Paystack
Paystack remains the customer funding/payment provider. SME API is the downstream VTU/bills provider.
