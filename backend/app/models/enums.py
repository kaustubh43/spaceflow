import enum


class UserRole(str, enum.Enum):
    designer = "designer"
    client = "client"


class MembershipRole(str, enum.Enum):
    """Per-project access level."""

    owner = "owner"          # full control, can manage members
    editor = "editor"        # edit everything
    contributor = "contributor"  # edit only items flagged client-editable
    viewer = "viewer"        # read-only, can comment


class LayerType(str, enum.Enum):
    architecture = "architecture"   # walls, doors, windows (base)
    furniture = "furniture"
    appliances = "appliances"
    electrical = "electrical"
    plumbing = "plumbing"
    lighting = "lighting"
    hvac = "hvac"
    networking = "networking"       # CCTV, data, speakers, low-voltage
    false_ceiling = "false_ceiling"
    flooring = "flooring"
    annotations = "annotations"     # dimensions, labels, notes


class ElementKind(str, enum.Enum):
    # architecture
    wall = "wall"
    room = "room"
    door = "door"
    window = "window"
    # generic placed object (furniture, appliance, fixture, light, etc.)
    item = "item"
    # specialized
    switchboard = "switchboard"
    electrical_point = "electrical_point"
    plumbing_line = "plumbing_line"
    plumbing_fixture = "plumbing_fixture"
    light = "light"
    hvac_unit = "hvac_unit"
    network_point = "network_point"
    annotation = "annotation"
