# Contract: POST /api/diensten/assign

## Request

**Method**: POST
**Content-Type**: application/json
**Authentication**: Required (Better Auth session cookie)

### Body

```json
{
  "idwaarneemgroep": 9,
  "van": 1711918800,
  "tot": 1711951200,
  "iddeelnemer": 42,
  "section": "middle"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| idwaarneemgroep | number | Yes | Waarneemgroep ID |
| van | number | Yes | Shift start (Unix seconds) |
| tot | number | Yes | Shift end (Unix seconds) |
| iddeelnemer | number \| null | Yes | Doctor ID to assign, or null to unassign |
| section | "middle" \| "top" \| "bottom" | Yes | Which stripe to modify |

## Response

### 200 OK - Success

```json
{ "success": true }
```

### 400 Bad Request

```json
{ "error": "Missing or invalid fields" }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### 405 Method Not Allowed

```json
{ "error": "Method not allowed" }
```

### 500 Internal Server Error

```json
{ "error": "Error message or 'Internal server error'" }
```

## Behavior Matrix

| Section | Operation | DB Action |
|---------|-----------|-----------|
| middle | assign | Exact match type 0/4/6 → UPDATE; else overlap match → UPDATE; else INSERT type=0 |
| middle | unassign | Find all overlapping type 0/4/6 → DELETE each |
| top | assign | Exact match type=5 → UPDATE; else INSERT type=5 |
| top | unassign | Exact match type=5 → DELETE |
| bottom | assign | Exact match type=11 → UPDATE; else INSERT type=11 |
| bottom | unassign | Exact match type=11 → DELETE |

All operations run within a database transaction.
