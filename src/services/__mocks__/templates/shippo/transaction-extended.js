export const transactionExtendedTemplate = (props) =>
  Object.freeze({
    object_state: props?.state ?? "VALID",
    status: props?.status ?? "SUCCESS",
    object_id: props.object_id,
    rate: {
      object_id: "rate_01234567890",
      amount: "8.02",
      currency: "USD",
      amount_local: "8.02",
      currency_local: "USD",
      provider: "USPS",
      servicelevel_name: "Priority Mail",
      servicelevel_token: "usps_priority",
      carrier_account: "carrier_id_here",
      amount_insurance_fee: "0.00000",
      insurance_amount: "0.00",
      insurance_currency: null,
      discount_group_name: null,
    },
    pickup_date: null,
    notification_email_from: false,
    notification_email_to: false,
    notification_email_other: "",
    tracking_number: props.tracking_number,
    address_to: {},
    tracking_status: null,
    tracking_url_provider: "https://tools.usps.com/",
    commercial_invoice_url: null,
    messages: [],
    customs_note: "",
    submission_note: "",
    metadata: props.metadata,
    is_return: props?.is_return ?? false,
    parcel: {},
    eta: null,
    order: {
      status: "PAID",
      order_number: props.order_number,
      object_id: props.order_object_id,
    },
  })
