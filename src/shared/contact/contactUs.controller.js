const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const httpStatus = require('../../core/http/status');
const contactUsService = require('./contactUs.service');

const createContactUs = catchAsync(async (req, res) => {
    const contactUs = await contactUsService.createContactUs(req.body);
    return responseWrapper(res, contactUs, 'New Contact Us Data Created Successfully.', httpStatus.CREATED);
});

const updateContactUs = catchAsync(async (req, res) => {
    const contactUs = await contactUsService.updateContactUs(req.body, req.params.id);
    return responseWrapper(res, contactUs, 'Update Successfully.', httpStatus.OK);
});

const getAllContactUs = catchAsync(async (req, res) => {
    const contactUs = await contactUsService.getAllContactUs();
    return responseWrapper(res, contactUs, '', httpStatus.OK);
});

const deleteContactUs = catchAsync(async (req, res) => {
    await contactUsService.deleteContactUs(req.params.id);
    return responseWrapper(res, '', 'Deleted Successfully.', httpStatus.OK);
});

module.exports = {
    createContactUs,
    updateContactUs,
    getAllContactUs,
    deleteContactUs,
};
