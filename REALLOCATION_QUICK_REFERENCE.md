# Reallocation API - Quick Reference

## Endpoints Summary

### Program Routes (`/api/program`)
1. **POST** `/reallocation-requests` - Create reallocation request
2. **GET** `/reallocation-requests` - Get all requests (with optional `?status=pending` filter)
3. **GET** `/reallocation-requests/:id` - Get specific request

### Finance Routes (`/api/finance`)
1. **GET** `/reallocation-requests` - Get all requests for assigned projects (with optional `?status=pending` filter)
2. **GET** `/reallocation-requests/:id` - Get specific request
3. **PUT** `/reallocation-requests/:id/approve` - Approve request (multipart/form-data with evidence image)
4. **PUT** `/reallocation-requests/:id/reject` - Reject request (JSON with rejectionReason)

---

## Sample JSON Requests

### 1. Create Project-to-Project Reallocation
```json
POST /api/program/reallocation-requests
{
  "requestType": "project_to_project",
  "sourceProjectId": "507f1f77bcf86cd799439011",
  "destinationProjectId": "507f1f77bcf86cd799439012",
  "amount": 5000,
  "reason": "Project B needs urgent funding"
}
```

### 2. Create Activity-to-Activity Reallocation
```json
POST /api/program/reallocation-requests
{
  "requestType": "activity_to_activity",
  "projectId": "507f1f77bcf86cd799439011",
  "sourceActivityId": "507f1f77bcf86cd799439013",
  "destinationActivityId": "507f1f77bcf86cd799439014",
  "amount": 3000,
  "reason": "Activity 2 needs more budget"
}
```

### 3. Create Subactivity-to-Subactivity Reallocation
```json
POST /api/program/reallocation-requests
{
  "requestType": "subactivity_to_subactivity",
  "projectId": "507f1f77bcf86cd799439011",
  "sourceActivityId": "507f1f77bcf86cd799439013",
  "destinationActivityId": "507f1f77bcf86cd799439013",
  "sourceSubactivityId": "507f1f77bcf86cd799439015",
  "destinationSubactivityId": "507f1f77bcf86cd799439016",
  "amount": 1500,
  "reason": "Reallocating budget between subactivities"
}
```

### 4. Approve Request (Same Currency)
```
PUT /api/finance/reallocation-requests/:id/approve
Content-Type: multipart/form-data

Form Data:
- evidenceImage: [file]
```

### 5. Approve Request (Different Currencies)
```
PUT /api/finance/reallocation-requests/:id/approve
Content-Type: multipart/form-data

Form Data:
- evidenceImage: [file]
- exchangeRate: 0.92
- exchangeRateDate: 2024-01-15
- exchangeRateSource: manual
```

### 6. Reject Request
```json
PUT /api/finance/reallocation-requests/:id/reject
{
  "rejectionReason": "Insufficient documentation provided"
}
```

---

## Response Examples

### Successful Creation Response
```json
{
  "success": true,
  "message": "Reallocation request created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "requestType": "project_to_project",
    "status": "pending",
    "amount": 5000,
    "sourceCurrency": "USD",
    "destinationCurrency": "EUR",
    "requiresExchangeRate": true,
    ...
  }
}
```

### Successful Approval Response
```json
{
  "success": true,
  "message": "Reallocation request approved and executed successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "status": "approved",
    "exchangeRate": 0.92,
    "convertedAmount": 4600,
    "evidenceImageUrl": "/uploads/1765213337176-evidence.jpg",
    "approvedBy": { "name": "Sarah Smith", "email": "sarah@example.com" },
    ...
  }
}
```

---

## Key Points

✅ **Project-to-Project**: Can reallocate between any projects (currency conversion supported)
✅ **Activity-to-Activity**: Must be within same project
✅ **Subactivity-to-Subactivity**: Must be within same activity
✅ **Currency Conversion**: Finance provides exchange rate manually when approving
✅ **Evidence Required**: Finance must upload evidence image when approving
✅ **Transactions**: All transfers are atomic (all succeed or all fail)
✅ **Balance Validation**: System checks sufficient balance before executing

---

## Testing with cURL

```bash
# Create request
curl -X POST http://localhost:3000/api/program/reallocation-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestType":"project_to_project","sourceProjectId":"...","destinationProjectId":"...","amount":5000,"reason":"..."}'

# Approve request
curl -X PUT http://localhost:3000/api/finance/reallocation-requests/:id/approve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "evidenceImage=@evidence.jpg" \
  -F "exchangeRate=0.92" \
  -F "exchangeRateSource=manual"

# Reject request
curl -X PUT http://localhost:3000/api/finance/reallocation-requests/:id/reject \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rejectionReason":"Insufficient documentation"}'
```

