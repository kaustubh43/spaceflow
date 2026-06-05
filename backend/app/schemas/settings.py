from pydantic import BaseModel


class AppSettingsOut(BaseModel):
    app_name: str
    currency_code: str
    currency_symbol: str
    currency_locale: str
    default_units: str
    accent_color: str

    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    app_name: str | None = None
    currency_code: str | None = None
    currency_symbol: str | None = None
    currency_locale: str | None = None
    default_units: str | None = None
    accent_color: str | None = None
