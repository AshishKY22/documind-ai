
# 1. Paste your webhook secret between the quotes below.
#    This must match RAZORPAY_WEBHOOK_SECRET in your .env file.
$secret = "ashish"

# 2. Read the payload file as raw bytes (not as a string).
$bodyBytes = [System.IO.File]::ReadAllBytes("$PSScriptRoot\payload.json")

# 3. Compute the HMAC-SHA256 signature over those exact bytes.
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
$hashBytes = $hmac.ComputeHash($bodyBytes)
$signature = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLower()



# 4. Send the request using --data-binary with the file directly,
#    so curl transmits the exact same bytes we just hashed.
curl.exe -X POST "http://localhost:3000/api/webhooks/razorpay" `
  -H "Content-Type: application/json" `
  -H "x-razorpay-signature: $signature" `
  --data-binary "@$PSScriptRoot\payload.json"