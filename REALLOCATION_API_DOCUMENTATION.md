# Reallocation API Documentation

## Overview
This API allows program users to create reallocation requests and finance users to approve/reject them. Supports reallocation between projects, activities, and subactivities with currency conversion support.

---

## Base URLs
- **Program Routes**: `/api/program`
- **Finance Routes**: `/api/finance`

---

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

---

## Program Routes

### 1. Create Reallocation Request
**POST** `/api/program/reallocation-requests`

Creates a new reallocation request. The request will be in "pending" status until finance approves or rejects it.

#### Request Body Examples:

**Project-to-Project Reallocation:**
```json
{
  "requestType": "project_to_project",
  "sourceProjectId": "507f1f77bcf86cd799439011",
  "destinationProjectId": "507f1f77bcf86cd799439012",
  "amount": 5000,
  "reason": "Project B needs urgent funding for emergency relief activities"
}
```

**Activity-to-Activity Reallocation (within same project):**
```json
{
  "requestType": "activity_to_activity",
  "projectId": "507f1f77bcf86cd799439011",
  "sourceActivityId": "507f1f77bcf86cd799439013",
  "destinationActivityId": "507f1f77bcf86cd799439014",
  "amount": 3000,
  "reason": "Activity 2 needs more budget for upcoming events"
}
```

**Subactivity-to-Subactivity Reallocation (within same activity):**
```json
{
  "requestType": "subactivity_to_subactivity",
  "projectId": "507f1f77bcf86cd799439011",
  "sourceActivityId": "507f1f77bcf86cd799439013",
  "destinationActivityId": "507f1f77bcf86cd799439013",
  "sourceSubactivityId": "507f1f77bcf86cd799439015",
  "destinationSubactivityId": "507f1f77bcf86cd799439016",
  "amount": 1500,
  "reason": "Reallocating budget from subactivity A to subactivity B"
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "message": "Reallocation request created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "requestType": "project_to_project",
    "status": "pending",
    "sourceProjectId": "507f1f77bcf86cd799439011",
    "destinationProjectId": "507f1f77bcf86cd799439012",
    "amount": 5000,
    "sourceCurrency": "USD",
    "destinationCurrency": "EUR",
    "exchangeRate": null,
    "convertedAmount": null,
    "reason": "Project B needs urgent funding...",
    "requiresExchangeRate": true,
    "requestedBy": "507f1f77bcf86cd799439010",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

#### Validation Rules:
- `requestType` must be: `"project_to_project"`, `"activity_to_activity"`, or `"subactivity_to_subactivity"`
- `amount` must be a positive number
- Source project must belong to the requesting user
- For activity reallocations: both activities must be in the same project
- For subactivity reallocations: both subactivities must be in the same activity
- Source must have sufficient balance

---

### 2. Get All Reallocation Requests
**GET** `/api/program/reallocation-requests?status=pending`

Gets all reallocation requests created by the logged-in program user.

#### Query Parameters:
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)

#### Example Request:
```
GET /api/program/reallocation-requests?status=pending
```

#### Response (200 OK):
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "requestType": "project_to_project",
      "status": "pending",
      "sourceProjectId": {
        "_id": "507f1f77bcf86cd799439011",
        "projectId": "EDU-2024-001",
        "title": "Education Support Program"
      },
      "destinationProjectId": {
        "_id": "507f1f77bcf86cd799439012",
        "projectId": "WEL-2024-002",
        "title": "Emergency Welfare Support"
      },
      "amount": 5000,
      "sourceCurrency": "USD",
      "destinationCurrency": "EUR",
      "reason": "Project B needs urgent funding...",
      "requestedBy": {
        "_id": "507f1f77bcf86cd799439010",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### 3. Get Reallocation Request by ID
**GET** `/api/program/reallocation-requests/:id`

Gets a specific reallocation request by ID.

#### Example Request:
```
GET /api/program/reallocation-requests/507f1f77bcf86cd799439020
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "requestType": "project_to_project",
    "status": "pending",
    "sourceProjectId": {
      "_id": "507f1f77bcf86cd799439011",
      "projectId": "EDU-2024-001",
      "title": "Education Support Program"
    },
    "destinationProjectId": {
      "_id": "507f1f77bcf86cd799439012",
      "projectId": "WEL-2024-002",
      "title": "Emergency Welfare Support"
    },
    "amount": 5000,
    "sourceCurrency": "USD",
    "destinationCurrency": "EUR",
    "exchangeRate": null,
    "convertedAmount": null,
    "reason": "Project B needs urgent funding...",
    "requestedBy": {
      "_id": "507f1f77bcf86cd799439010",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

---

## Finance Routes

### 1. Get All Reallocation Requests
**GET** `/api/finance/reallocation-requests?status=pending`

Gets all reallocation requests for projects assigned to the logged-in finance user.

#### Query Parameters:
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)

#### Example Request:
```
GET /api/finance/reallocation-requests?status=pending
```

#### Response (200 OK):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "requestType": "project_to_project",
      "status": "pending",
      "sourceProjectId": {
        "_id": "507f1f77bcf86cd799439011",
        "projectId": "EDU-2024-001",
        "title": "Education Support Program"
      },
      "destinationProjectId": {
        "_id": "507f1f77bcf86cd799439012",
        "projectId": "WEL-2024-002",
        "title": "Emergency Welfare Support"
      },
      "amount": 5000,
      "sourceCurrency": "USD",
      "destinationCurrency": "EUR",
      "requiresExchangeRate": true,
      "reason": "Project B needs urgent funding...",
      "requestedBy": {
        "_id": "507f1f77bcf86cd799439010",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Get Reallocation Request by ID
**GET** `/api/finance/reallocation-requests/:id`

Gets a specific reallocation request by ID (must be for a project assigned to finance user).

#### Example Request:
```
GET /api/finance/reallocation-requests/507f1f77bcf86cd799439020
```

#### Response (200 OK):
Same format as Program route.

---

### 3. Approve Reallocation Request
**PUT** `/api/finance/reallocation-requests/:id/approve`

Approves a reallocation request and executes the transfer. Requires evidence image upload.

#### Request Format:
**Content-Type**: `multipart/form-data`

#### Form Data Fields:
- `evidenceImage` (required): Image file (jpg, png, gif, webp, max 5MB)
- `exchangeRate` (required if currencies differ): Exchange rate number (e.g., 0.92)
- `exchangeRateDate` (optional): Date when exchange rate was applied (ISO format)
- `exchangeRateSource` (optional): Source of exchange rate (`"manual"`, `"api"`, `"bank"`)

#### Example Request (Same Currency):
```
PUT /api/finance/reallocation-requests/507f1f77bcf86cd799439020/approve
Content-Type: multipart/form-data

Form Data:
- evidenceImage: [file: evidence.jpg]
```

#### Example Request (Different Currencies):
```
PUT /api/finance/reallocation-requests/507f1f77bcf86cd799439020/approve
Content-Type: multipart/form-data

Form Data:
- evidenceImage: [file: exchange_rate_screenshot.jpg]
- exchangeRate: 0.92
- exchangeRateDate: 2024-01-15
- exchangeRateSource: manual
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Reallocation request approved and executed successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "requestType": "project_to_project",
    "status": "approved",
    "sourceProjectId": {
      "_id": "507f1f77bcf86cd799439011",
      "projectId": "EDU-2024-001",
      "title": "Education Support Program"
    },
    "destinationProjectId": {
      "_id": "507f1f77bcf86cd799439012",
      "projectId": "WEL-2024-002",
      "title": "Emergency Welfare Support"
    },
    "amount": 5000,
    "sourceCurrency": "USD",
    "destinationCurrency": "EUR",
    "exchangeRate": 0.92,
    "convertedAmount": 4600,
    "exchangeRateDate": "2024-01-15T00:00:00.000Z",
    "exchangeRateSource": "manual",
    "evidenceImageUrl": "/uploads/1765213337176-evidence.jpg",
    "reason": "Project B needs urgent funding...",
    "approvedBy": {
      "_id": "507f1f77bcf86cd799439021",
      "name": "Sarah Smith",
      "email": "sarah@example.com"
    },
    "approvedAt": "2024-01-15T14:30:00.000Z",
    "requestedBy": {
      "_id": "507f1f77bcf86cd799439010",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

#### What Happens:
1. Validates evidence image is uploaded
2. If currencies differ, validates exchange rate is provided
3. Calculates `convertedAmount = amount × exchangeRate`
4. Validates source has sufficient balance
5. Executes transfer atomically using MongoDB transaction:
   - Subtracts `amount` from source (in source currency)
   - Adds `convertedAmount` to destination (in destination currency)
6. Updates request status to "approved"
7. Stores evidence image URL and exchange rate details

---

### 4. Reject Reallocation Request
**PUT** `/api/finance/reallocation-requests/:id/reject`

Rejects a reallocation request with a reason.

#### Request Body:
```json
{
  "rejectionReason": "Insufficient documentation provided. Please provide more details about the urgency."
}
```

#### Example Request:
```
PUT /api/finance/reallocation-requests/507f1f77bcf86cd799439020/reject
Content-Type: application/json

{
  "rejectionReason": "Insufficient documentation provided."
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "message": "Reallocation request rejected successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "requestType": "project_to_project",
    "status": "rejected",
    "rejectionReason": "Insufficient documentation provided.",
    "approvedBy": {
      "_id": "507f1f77bcf86cd799439021",
      "name": "Sarah Smith",
      "email": "sarah@example.com"
    },
    "approvedAt": "2024-01-15T14:30:00.000Z",
    ...
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Please provide requestType, amount, and reason"
}
```

### 401 Unauthorized
```json
{
  "message": "Not authorized"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Program role only."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Reallocation request not found or you do not have access"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error. Please try again later."
}
```

---

## Testing Examples

### Using cURL

**1. Create Reallocation Request (Project-to-Project):**
```bash
curl -X POST http://localhost:3000/api/program/reallocation-requests \
  -H "Authorization: Bearer YOUR_PROGRAM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "project_to_project",
    "sourceProjectId": "507f1f77bcf86cd799439011",
    "destinationProjectId": "507f1f77bcf86cd799439012",
    "amount": 5000,
    "reason": "Project B needs urgent funding"
  }'
```

**2. Approve Request (with different currencies):**
```bash
curl -X PUT http://localhost:3000/api/finance/reallocation-requests/507f1f77bcf86cd799439020/approve \
  -H "Authorization: Bearer YOUR_FINANCE_TOKEN" \
  -F "evidenceImage=@/path/to/evidence.jpg" \
  -F "exchangeRate=0.92" \
  -F "exchangeRateDate=2024-01-15" \
  -F "exchangeRateSource=manual"
```

**3. Reject Request:**
```bash
curl -X PUT http://localhost:3000/api/finance/reallocation-requests/507f1f77bcf86cd799439020/reject \
  -H "Authorization: Bearer YOUR_FINANCE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rejectionReason": "Insufficient documentation"
  }'
```

### Using Postman

1. **Create Request:**
   - Method: POST
   - URL: `http://localhost:3000/api/program/reallocation-requests`
   - Headers: `Authorization: Bearer YOUR_TOKEN`
   - Body: raw JSON (see examples above)

2. **Approve Request:**
   - Method: PUT
   - URL: `http://localhost:3000/api/finance/reallocation-requests/:id/approve`
   - Headers: `Authorization: Bearer YOUR_TOKEN`
   - Body: form-data
     - Key: `evidenceImage`, Type: File, Value: [select file]
     - Key: `exchangeRate`, Type: Text, Value: `0.92`
     - Key: `exchangeRateDate`, Type: Text, Value: `2024-01-15`
     - Key: `exchangeRateSource`, Type: Text, Value: `manual`

---

## Notes

1. **Currency Conversion**: When currencies differ, finance must provide exchange rate during approval
2. **Transactions**: All reallocations use MongoDB transactions for atomicity
3. **File Uploads**: Evidence images are stored in `/uploads` directory
4. **Balance Validation**: System validates sufficient balance before executing transfers
5. **Activity/Subactivity Constraints**: Activities must be in same project, subactivities must be in same activity

