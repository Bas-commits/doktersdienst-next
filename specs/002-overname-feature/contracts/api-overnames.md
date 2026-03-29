# API Contracts: Overname Feature

## POST /api/overnames/propose

Create an overname voorstel (type=4, status=pending).

**Request body**:
```json
{
  "iddienstovern": 123,
  "iddeelnovern": 45,
  "van": 1741282800,
  "tot": 1741315200,
  "idwaarneemgroep": 9
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| iddienstovern | number | yes | ID of the original dienst being taken over |
| iddeelnovern | number | yes | ID of the target doctor |
| van | number | yes | Start time (Unix seconds). Equals original shift start for full overname, or custom start for partial. |
| tot | number | yes | End time (Unix seconds). Equals original shift end for full overname, or custom end for partial. |
| idwaarneemgroep | number | yes | Waarneemgroep ID (same as original dienst) |

**Success response** (201):
```json
{ "success": true, "id": 456 }
```

**Error responses**:
- 400: `{ "error": "Invalid time range" }` — start >= end or outside original shift bounds
- 400: `{ "error": "Cannot propose overname to yourself" }` — target = proposing doctor
- 409: `{ "error": "Active proposal already exists for this shift" }` — pending proposal exists
- 401: `{ "error": "Unauthorized" }` — no session
- 404: `{ "error": "Dienst not found" }` — iddienstovern doesn't exist

**Validation rules**:
1. Original dienst (iddienstovern) must exist and be type=0 (assigned shift)
2. Target doctor (iddeelnovern) must be in the same waarneemgroep
3. Target doctor must not be the proposing doctor (senderId)
4. No existing type=4 record with status='pending' for the same iddienstovern
5. van/tot must be within the original dienst's time range

---

## POST /api/overnames/respond

Accept or decline an overname voorstel.

**Request body**:
```json
{
  "id": 456,
  "action": "accept"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | yes | ID of the type=4 dienst (the proposal) |
| action | string | yes | `"accept"` or `"decline"` |

**Accept behavior**:
- Changes type from 4 to 6
- Changes status from `'pending'` to `'accepted'`

**Decline behavior**:
- Keeps type as 4
- Changes status from `'pending'` to `'declined'`

**Success response** (200):
```json
{ "success": true }
```

**Error responses**:
- 400: `{ "error": "Invalid action" }` — not accept/decline
- 403: `{ "error": "Not authorized" }` — logged-in user is not the target doctor (iddeelnovern)
- 404: `{ "error": "Proposal not found" }` — ID doesn't exist or not type=4/status=pending
- 401: `{ "error": "Unauthorized" }` — no session

---

## GET /api/overnames/pending

Fetch pending overname proposals for the logged-in doctor (for header badge/popover).

**Query parameters**: None (uses session to identify the doctor).

**Success response** (200):
```json
{
  "verzoeken": [
    {
      "id": 456,
      "datum": "Vrijdag 11 juli",
      "van": "08:00",
      "tot": "16:00",
      "week": 28,
      "vanArts": {
        "initialen": "JD",
        "naam": "Jan de Vries",
        "akkoord": true
      },
      "naarArts": {
        "initialen": "MS",
        "naam": "Marie Smith",
        "akkoord": false
      }
    }
  ]
}
```

**Notes**:
- Returns proposals where `iddeelnovern` = logged-in doctor's deelnemer ID
- Only returns status='pending' proposals
- `vanArts.akkoord` is always true (proposer initiated)
- `naarArts.akkoord` is always false (pending acceptance)
- Response shape matches the existing `OvernameVerzoek` interface used by the header popover
