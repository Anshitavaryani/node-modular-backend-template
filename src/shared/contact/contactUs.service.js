const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { models: { ContactUs } } = require('./models');

const createContactUs = async (reqBody) => {
    const contactUs = await ContactUs.create({
        email: reqBody.email,
        mobile: reqBody.mobile,
        address: reqBody.address,
    });
    if (!contactUs) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new ContactUs');
    }
    return contactUs;
};

const updateContactUs = async (reqBody, id) => {
    const contactUs = await ContactUs.findByPk(id);
    if (!contactUs) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Data not found');
    }

    // Empty values leave the stored field unchanged.
    if (reqBody.email) contactUs.email = reqBody.email;
    if (reqBody.address) contactUs.address = reqBody.address;
    if (reqBody.mobile) contactUs.mobile = reqBody.mobile;

    await contactUs.save();
    return contactUs;
};

const getAllContactUs = async () => ContactUs.findAll({
    attributes: ['id', 'email', 'address', 'mobile'],
    where: { is_active: true },
});

const deleteContactUs = async (id) => {
    const contactUs = await ContactUs.findByPk(id);
    if (!contactUs) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Data not found');
    }
    await contactUs.destroy();
};

module.exports = {
    createContactUs,
    getAllContactUs,
    updateContactUs,
    deleteContactUs,
};
