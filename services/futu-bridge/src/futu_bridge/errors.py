class BridgeError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class OpenDUnavailable(BridgeError):
    def __init__(self, message: str = "Futu OpenD is unavailable"):
        super().__init__("opend_unavailable", message, 503)


class AccountSelectionRequired(BridgeError):
    def __init__(self, accounts):
        super().__init__(
            "account_selection_required",
            "Set FUTU_TARGET_ACC_ID to an explicitly selected real account",
            409,
            {"accounts": [item.model_dump(mode="json") for item in accounts]},
        )
