# Pickleball Poacher

City of Ottawa recreation centre drop-in reservation script.

## Why

The City of Ottawa opens registration for drop-in events 2 days in advance at 6 PM. It can be hard to remember to sign up and the site also suffers from traffic at that time making it slow. If you intend to sign up for multiple people or multiple slots, it can be a delecate balancing act. On top of that, if you try to fill out the form multiple times without refreshing the browser page, _it can fail silently, informing you that your reservation was successful when it wasn't._

## How

The goal is to enumerate the slots you'd like to reserve, and then run the script on a schedule where it will wake up once a day at 6 PM and fulfill any outstanding reservations. It should be able to do these in tandem and will retry if the site's connection is spotty. It won't stop until it finds a spot, so if the day fills up it will retry over time.

## Configure

Run `node index.js init` to create a config file. Its path will be in the console.

You can then edit the config file in order to add which slots you want to reserve. All the drop-in sites have the same URL format, e.g. [Hintonburg Community Center](https://reservation.frontdesksuite.ca/rcfs/hintonburgcc/). The part of the URL that belongs in the location field is "hintonburgcc". The time should include AM/PM so that the script won't try to register for things in the past.

This configuration file is also used to store successful registrations.

## Run

To run, simply use `node index.js register` and the script will try to fill all desired slots, every 5 minutes for the next 23.5 hours. It will stop when it has registered all desired slots.
