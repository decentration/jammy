import { Codec } from "scale-ts";
import { ServiceItem } from "../../types";
import { ServiceItemCodec } from "./ServiceItemCodec";
import { DiscriminatorCodec } from "../../../../codecs";

// Services is an array of ServiceItem
export const ServicesCodec: Codec<ServiceItem[]> =
  DiscriminatorCodec(ServiceItemCodec);
