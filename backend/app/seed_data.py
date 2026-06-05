"""Static seed data: the catalog of placeable presets."""
from app.models.enums import ElementKind, LayerType

# (name, category, layer, kind, w, d, h, color, icon, unit_cost, props)
CATALOG: list[tuple] = [
    # ---- Furniture ----
    ("TV Unit", "Living", LayerType.furniture, ElementKind.item, 180, 45, 50, "#6b7280", "tv", 25000, {}),
    ("Sofa (3-seat)", "Living", LayerType.furniture, ElementKind.item, 210, 90, 85, "#8b5e3c", "sofa", 35000, {}),
    ("Armchair", "Living", LayerType.furniture, ElementKind.item, 80, 85, 85, "#a16207", "chair", 12000, {}),
    ("Coffee Table", "Living", LayerType.furniture, ElementKind.item, 110, 60, 45, "#92400e", "table", 8000, {}),
    ("Dining Table (6)", "Dining", LayerType.furniture, ElementKind.item, 180, 90, 75, "#7c4a23", "table", 30000, {}),
    ("Dining Chair", "Dining", LayerType.furniture, ElementKind.item, 45, 50, 90, "#7c4a23", "chair", 4000, {}),
    ("Double Bed", "Bedroom", LayerType.furniture, ElementKind.item, 160, 200, 60, "#9d6b53", "bed", 40000, {}),
    ("Single Bed", "Bedroom", LayerType.furniture, ElementKind.item, 100, 200, 60, "#9d6b53", "bed", 22000, {}),
    ("Wardrobe / Cupboard", "Bedroom", LayerType.furniture, ElementKind.item, 200, 60, 220, "#78350f", "wardrobe", 45000, {}),
    ("Study Desk", "Study", LayerType.furniture, ElementKind.item, 120, 60, 75, "#6b7280", "desk", 12000, {}),
    ("Bookshelf", "Study", LayerType.furniture, ElementKind.item, 90, 35, 200, "#6b7280", "shelf", 9000, {}),
    ("Kitchen Counter", "Kitchen", LayerType.furniture, ElementKind.item, 240, 60, 90, "#4b5563", "counter", 60000, {}),
    ("Kitchen Island", "Kitchen", LayerType.furniture, ElementKind.item, 180, 90, 90, "#4b5563", "counter", 50000, {}),

    # ---- Appliances ----
    ("Refrigerator", "Kitchen", LayerType.appliances, ElementKind.item, 70, 70, 180, "#475569", "fridge", 45000, {"power_w": 250}),
    ("Washing Machine", "Utility", LayerType.appliances, ElementKind.item, 60, 60, 85, "#475569", "washer", 30000, {"power_w": 2000}),
    ("Microwave", "Kitchen", LayerType.appliances, ElementKind.item, 50, 40, 30, "#475569", "microwave", 9000, {"power_w": 1200}),
    ("Dishwasher", "Kitchen", LayerType.appliances, ElementKind.item, 60, 60, 85, "#475569", "dishwasher", 35000, {"power_w": 1800}),
    ("Television", "Living", LayerType.appliances, ElementKind.item, 140, 8, 80, "#1f2937", "tv", 80000, {"power_w": 150}),
    ("Water Geyser", "Bathroom", LayerType.appliances, ElementKind.item, 45, 25, 55, "#475569", "geyser", 12000, {"power_w": 3000}),

    # ---- Electrical ----
    ("Switchboard (6-module)", "Electrical", LayerType.electrical, ElementKind.switchboard, 22, 8, 14, "#f59e0b", "switchboard", 1500,
     {"modules": 6, "buttons": [{"label": "Light 1", "type": "switch"}, {"label": "Light 2", "type": "switch"}, {"label": "Fan", "type": "regulator"}, {"label": "Socket 5A", "type": "socket"}, {"label": "Socket 15A", "type": "socket"}, {"label": "Spare", "type": "blank"}], "circuit": "Lighting-1"}),
    ("Power Socket (16A)", "Electrical", LayerType.electrical, ElementKind.electrical_point, 8, 8, 8, "#f59e0b", "socket", 350, {"amperage": 16, "circuit": "Power-1"}),
    ("Distribution Board", "Electrical", LayerType.electrical, ElementKind.electrical_point, 35, 12, 45, "#d97706", "db", 6000, {"mcb_count": 8, "circuit": "Main"}),

    # ---- Plumbing ----
    ("WC / Toilet", "Bathroom", LayerType.plumbing, ElementKind.plumbing_fixture, 38, 65, 40, "#0ea5e9", "wc", 12000, {"supply": "cold", "drain": "soil"}),
    ("Wash Basin", "Bathroom", LayerType.plumbing, ElementKind.plumbing_fixture, 55, 45, 85, "#0ea5e9", "basin", 8000, {"supply": "hot_cold", "drain": "waste"}),
    ("Shower", "Bathroom", LayerType.plumbing, ElementKind.plumbing_fixture, 90, 90, 10, "#0ea5e9", "shower", 15000, {"supply": "hot_cold", "drain": "floor"}),
    ("Kitchen Sink", "Kitchen", LayerType.plumbing, ElementKind.plumbing_fixture, 80, 50, 20, "#0ea5e9", "sink", 9000, {"supply": "hot_cold", "drain": "waste"}),
    ("Water Pipe Run", "Plumbing", LayerType.plumbing, ElementKind.plumbing_line, 0, 0, 0, "#0284c7", "pipe", 0, {"diameter_mm": 20, "type": "supply"}),

    # ---- Lighting ----
    ("Ceiling Light", "Lighting", LayerType.lighting, ElementKind.light, 30, 30, 10, "#fde047", "light", 1500, {"wattage": 18, "type": "led_panel"}),
    ("Pendant Light", "Lighting", LayerType.lighting, ElementKind.light, 25, 25, 40, "#fde047", "pendant", 4000, {"wattage": 12, "type": "pendant"}),
    ("Spotlight", "Lighting", LayerType.lighting, ElementKind.light, 10, 10, 10, "#fde047", "spot", 800, {"wattage": 7, "type": "cob"}),
    ("Wall Sconce", "Lighting", LayerType.lighting, ElementKind.light, 15, 12, 25, "#fde047", "sconce", 2500, {"wattage": 9, "type": "wall"}),

    # ---- HVAC ----
    ("Split AC Indoor", "HVAC", LayerType.hvac, ElementKind.hvac_unit, 100, 22, 30, "#34d399", "ac", 42000, {"capacity_ton": 1.5, "power_w": 1600}),
    ("Ceiling Fan", "HVAC", LayerType.hvac, ElementKind.hvac_unit, 120, 120, 30, "#34d399", "fan", 3500, {"sweep_mm": 1200}),
    ("Exhaust Fan", "HVAC", LayerType.hvac, ElementKind.hvac_unit, 25, 25, 12, "#34d399", "exhaust", 1800, {}),

    # ---- Networking / Low-voltage ----
    ("CCTV Camera", "Security", LayerType.networking, ElementKind.network_point, 12, 12, 12, "#a78bfa", "cctv", 4500, {"type": "dome"}),
    ("Router / AP", "Network", LayerType.networking, ElementKind.network_point, 20, 20, 5, "#a78bfa", "router", 6000, {"type": "wifi6"}),
    ("Data Outlet (RJ45)", "Network", LayerType.networking, ElementKind.network_point, 8, 8, 8, "#a78bfa", "data", 600, {"cat": "6"}),
    ("Ceiling Speaker", "Network", LayerType.networking, ElementKind.network_point, 18, 18, 10, "#a78bfa", "speaker", 5000, {}),

    # ---- Architecture (placeable) ----
    ("Door (single)", "Openings", LayerType.architecture, ElementKind.door, 90, 12, 210, "#b45309", "door", 9000, {"swing": "left"}),
    ("Window", "Openings", LayerType.architecture, ElementKind.window, 120, 12, 120, "#7dd3fc", "window", 7000, {"sill_cm": 90}),
]
