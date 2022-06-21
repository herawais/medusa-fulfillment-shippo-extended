import { FulfillmentService } from "medusa-interfaces"
import { humanizeAmount, MedusaError } from "medusa-core-utils"
import shippo from "shippo"
import { shippoAddress, shippoLineItem } from "../utils/shippo"

class ShippoFulfillmentService extends FulfillmentService {
  static identifier = "shippo"

  constructor({ addressRepository, cartService, totalsService }, options) {
    super()

    this.options_ = options

    /** @private @const {AddressRepository} */
    this.addressRepository_ = addressRepository

    /** @private @const {CartService} */
    this.cartService_ = cartService

    /** @private @const {Shippo} */
    this.shippo_ = shippo(this.options_.api_key)

    /** @private @const {TotalsService} */
    this.totalsService_ = totalsService
  }

  async getFulfillmentOptions() {
    const shippingOptions = await this.shippo_.carrieraccount
      .list({ service_levels: true, results: 100 })
      .then((r) =>
        r.results
          .filter((e) => e.active)
          .flatMap((item) =>
            item.service_levels.map((e) => {
              const { service_levels, ...shippingOption } = {
                ...e,
                id: `shippo-fulfillment-${e.token}`,
                name: `${item.carrier_name} ${e.name}`,
                carrier_id: item.object_id,
                is_group: false,
                ...item,
              }
              return shippingOption
            })
          )
      )
      .catch((e) => {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, e)
      })

    const returnOptions = shippingOptions
      .filter((e) => e.supports_return_labels)
      .map((e) => ({
        ...e,
        name: `${e.name} - Support return labels`,
        is_return: true,
      }))

    const shippingOptionGroups = await this.shippo_.servicegroups
      .list()
      .then((response) =>
        response.map((e) => ({
          id: `shippo-fulfillment-${e.object_id}`,
          is_group: true,
          ...e,
        }))
      )
      .catch((e) => {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, e)
      })

    return [...shippingOptions, ...shippingOptionGroups]
  }

  async validateOption(data) {
    return true
  }

  async validateFulfillmentData(optionData, data, cart) {
    return {
      ...data,
    }
  }

  async createFulfillment(
    methodData,
    fulfillmentItems,
    fromOrder,
    fulfillment
  ) {
    const lineItems = await Promise.all(
      fulfillmentItems.map(async (item) => {
        const totals = await this.totalsService_.getLineItemTotals(
          item,
          fromOrder
        )
        return shippoLineItem(
          item,
          totals.subtotal,
          fromOrder.region.currency_code
        )
      })
    )

    const toAddress = await this.createShippoAddress(
      fromOrder.shipping_address,
      fromOrder.email
    ).catch((e) => {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, e)
    })

    const totalWeight = lineItems
      .map((e) => e.weight * e.quantity)
      .reduce((sum, current) => sum + current, 0)

    const shippingOptionName =
      fromOrder.shipping_methods[0].shipping_option.name
    const shippingCostCurrency = fromOrder.currency_code.toUpperCase()

    const currencyCode = fromOrder.currency_code.toUpperCase()

    const shippoParcel = await this.shippo_.userparceltemplates
      .retrieve(fromOrder.metadata.shippo_parcel)
      .catch((e) => {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, e)
      })

    const shipppOrder = await this.shippo_.order
      .create({
        order_number: fromOrder.display_id,
        order_status: "PAID",
        to_address: toAddress.object_id,
        line_items: lineItems,
        placed_at: fromOrder.created_at,
        shipping_cost: humanizeAmount(fromOrder.shipping_total, currencyCode),
        shipping_cost_currency: shippingCostCurrency,
        shipping_method: `${shippingOptionName} ${shippingCostCurrency}`,
        total_tax: humanizeAmount(fromOrder.tax_total, currencyCode),
        total_price: humanizeAmount(fromOrder.total, currencyCode),
        subtotal_price: humanizeAmount(fromOrder.subtotal, currencyCode),
        currency: currencyCode,
        weight: totalWeight,
        weight_unit: this.options_.weight_unit_type,
      })
      .then((response) => ({
        shippo_order_id: response.object_id,
        shippo_parcel: shippoParcel.object_id,
      }))
      .catch((e) => {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, e)
      })

    return shipppOrder
  }

  canCalculate(data) {
    return data.type === "LIVE_RATE"
  }

  async calculatePrice(fulfillmentOption, fulfillmentData, cart) {}

  async createShippoAddress(address, email) {
    return await this.shippo_.address.create(shippoAddress(address, email))
  }
}

export default ShippoFulfillmentService
