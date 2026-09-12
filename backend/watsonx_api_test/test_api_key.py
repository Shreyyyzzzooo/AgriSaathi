import requests
import getpass

api_key = getpass.getpass("Enter your IBM Cloud API key: ")

response = requests.post(
    "https://iam.cloud.ibm.com/identity/token",
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    },
    data={
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": api_key,
    },
)

print("\nHTTP Status:", response.status_code)

if response.status_code == 200:
    data = response.json()
    print("✅ API KEY IS VALID")
    print("IAM authentication succeeded.")
    print("Token received:", bool(data.get("access_token")))
    print("Token expires in:", data.get("expires_in"), "seconds")
else:
    print("❌ API KEY AUTHENTICATION FAILED")
    print(response.text)