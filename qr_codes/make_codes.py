import os
import qrcode

# List of profiles (replace with your actual profile names or IDs)
profiles = [
    "elderly",
    "student",
    "office_worker",
    "tourist",
    "families",
    "shop_owner"
]

# Base URL for profiles (replace with your actual base URL)
base_url = "https://mobility-concepcion-workshop.up.railway.app"

# Output directory for QR codes
output_dir = "./codes"
os.makedirs(output_dir, exist_ok=True)

for profile in profiles:
    url = f"{base_url}/join/{profile}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(os.path.join(output_dir, f"{profile}.png"))

print("QR codes generated and saved in ./codes")